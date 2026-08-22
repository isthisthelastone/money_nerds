import { revalidatePath } from "next/cache";
import { after, NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import { notifyIndexNow } from "@/lib/indexnow";
import {
  parseComposerPayload,
  validateUploadedMedia,
} from "@/lib/media/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { CommentCardData, MediaAsset } from "@/lib/models";
import { parseJsonArray } from "@/lib/format";

const MAX_COMPOSER_REQUEST_BYTES = 32 * 1024;
const COMMENT_RATE_LIMIT = 60;
const COMMENT_RATE_WINDOW_SECONDS = 60 * 60;
const COMMENT_PAGE_SIZES = [10, 25, 50, 100] as const;

function checkDeclaredRequestSize(request: NextRequest) {
  const value = request.headers.get("content-length");
  if (!value) return;
  if (!/^\d+$/.test(value)) throw new Error("INVALID_REQUEST_BODY");
  if (Number(value) > MAX_COMPOSER_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
}

async function readBoundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_COMPOSER_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

async function readComposerFormData(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    throw new Error("UNSUPPORTED_REQUEST_TYPE");
  }

  const bytes = await readBoundedBody(request);

  let formData: FormData;
  try {
    formData = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new Error("INVALID_REQUEST_BODY");
  }

  const expectedFields = ["nickname", "body", "category", "mediaIds", "postId", "parentId"];
  if (expectedFields.some((field) => formData.getAll(field).length > 1)) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  if (expectedFields.some((field) => {
    const value = formData.get(field);
    return value !== null && typeof value !== "string";
  })) {
    throw new Error("INVALID_REQUEST_BODY");
  }

  const nickname = String(formData.get("nickname") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (nickname.length > 50) throw new Error("NICKNAME_TOO_LONG");
  if (body.length > 5_000) throw new Error("MESSAGE_TOO_LONG");
  if (String(formData.get("category") ?? "").length > 32) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  if (String(formData.get("mediaIds") ?? "[]").length > 256) {
    throw new Error("INVALID_MEDIA_METADATA");
  }
  if (String(formData.get("postId") ?? "").length > 20) throw new Error("INVALID_POST");
  if (String(formData.get("parentId") ?? "").length > 20) throw new Error("INVALID_PARENT");
  return formData;
}

async function consumeCommentRateLimit(
  supabase: ReturnType<typeof createAdminSupabase>,
  walletAddress: string,
) {
  const { error } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: walletAddress,
    p_action: "publish_comment",
    p_limit: COMMENT_RATE_LIMIT,
    p_window_seconds: COMMENT_RATE_WINDOW_SECONDS,
  });
  if (!error) return;
  if (error.message.includes("Wallet action rate limit exceeded")) {
    throw new Error("RATE_LIMITED", { cause: error });
  }
  throw new Error("RATE_LIMIT_UNAVAILABLE", { cause: error });
}

function classifyPublishError(message: string) {
  if (message.includes("Post does not exist")) return "POST_NOT_FOUND";
  if (message.includes("Parent comment does not exist")) return "PARENT_NOT_FOUND";
  if (message.includes("Media is missing, expired, or already published")) {
    return "MEDIA_UPLOAD_EXPIRED";
  }
  if (message.includes("Invalid nickname")) return "NICKNAME_REQUIRED";
  if (message.includes("Invalid comment body")) return "MESSAGE_REQUIRED";
  if (message.includes("Invalid media list")) return "INVALID_MEDIA_METADATA";
  return "COMMENT_NOT_CREATED";
}

function commentErrorResponse(code: string) {
  const responses: Record<string, { message: string; status: number }> = {
    REQUEST_TOO_LARGE: { message: "That comment request is too large.", status: 413 },
    UNSUPPORTED_REQUEST_TYPE: { message: "Send comment details as form data.", status: 415 },
    INVALID_REQUEST_BODY: { message: "Comment details could not be read.", status: 400 },
    INVALID_POST: { message: "Invalid post.", status: 400 },
    INVALID_PARENT: { message: "Invalid parent comment.", status: 400 },
    POST_NOT_FOUND: { message: "That post no longer exists.", status: 404 },
    PARENT_NOT_FOUND: { message: "The comment you replied to no longer exists.", status: 404 },
    NICKNAME_REQUIRED: { message: "Add a nickname for this comment.", status: 400 },
    NICKNAME_TOO_LONG: { message: "Keep your nickname to 50 characters.", status: 400 },
    MESSAGE_REQUIRED: { message: "Write something or attach media.", status: 400 },
    MESSAGE_TOO_LONG: { message: "Keep your comment to 5,000 characters.", status: 400 },
    TOO_MANY_FILES: { message: "Attach no more than four files.", status: 400 },
    INVALID_MEDIA: { message: "Use an image, audio file, or video up to 15 MB.", status: 400 },
    INVALID_MEDIA_KIND: { message: "One attachment type did not match its file.", status: 400 },
    INVALID_MEDIA_METADATA: { message: "Attachment details could not be read.", status: 400 },
    INVALID_MEDIA_OWNER: { message: "One attachment does not belong to this wallet.", status: 403 },
    MEDIA_ALREADY_USED: { message: "One attachment has already been published.", status: 409 },
    MEDIA_UPLOAD_EXPIRED: { message: "One attachment expired. Attach it again.", status: 410 },
    MEDIA_UPLOAD_INCOMPLETE: { message: "One attachment did not finish uploading.", status: 409 },
    INVALID_MEDIA_CONTENT: { message: "One attachment's contents do not match its file type.", status: 415 },
    RATE_LIMITED: { message: "You are commenting too quickly. Try again later.", status: 429 },
    RATE_LIMIT_UNAVAILABLE: { message: "Commenting is temporarily unavailable. Try again.", status: 503 },
    COMMENT_NOT_CREATED: { message: "Your comment could not be published.", status: 500 },
  };
  const response = responses[code] ?? responses.COMMENT_NOT_CREATED;
  return apiError(response.message, response.status);
}

export async function GET(request: NextRequest) {
  const postId = Number(request.nextUrl.searchParams.get("postId"));
  if (!Number.isSafeInteger(postId) || postId <= 0) return apiError("Invalid post.");
  const requestedPageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 25);
  const pageSize = COMMENT_PAGE_SIZES.includes(
    requestedPageSize as (typeof COMMENT_PAGE_SIZES)[number],
  )
    ? requestedPageSize
    : 25;
  const afterId = Number(request.nextUrl.searchParams.get("afterId") ?? 0);
  if (!Number.isSafeInteger(afterId) || afterId < 0) return apiError("Invalid comment cursor.");

  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("comment_cards")
    .select("*")
    .eq("post_id", postId)
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(pageSize + 1);

  if (error) return apiError("Comments could not be loaded.", 500);
  const hasMore = (data?.length ?? 0) > pageSize;
  const page = (data ?? []).slice(0, pageSize);
  const comments = page.map((row) => ({
    ...row,
    like_count: Number(row.like_count ?? 0),
    verified_donation_lamports: Number(row.verified_donation_lamports ?? 0),
    media: parseJsonArray<MediaAsset>(row.media),
  })) as CommentCardData[];
  return NextResponse.json({
    comments,
    hasMore,
    nextCursor: comments.at(-1)?.id ?? afterId,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  try {
    checkDeclaredRequestSize(request);
  } catch (error) {
    return commentErrorResponse(error instanceof Error ? error.message : "INVALID_REQUEST_BODY");
  }

  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const formData = await readComposerFormData(request);
    const postId = Number(formData.get("postId"));
    if (!Number.isSafeInteger(postId) || postId <= 0) return commentErrorResponse("INVALID_POST");

    const rawParentId = String(formData.get("parentId") ?? "").trim();
    const parsedParentId = rawParentId ? Number(rawParentId) : null;
    if (
      parsedParentId !== null &&
      (!Number.isSafeInteger(parsedParentId) || parsedParentId <= 0)
    ) {
      return commentErrorResponse("INVALID_PARENT");
    }
    const parentId = parsedParentId;
    const payload = parseComposerPayload(formData);
    const supabase = createAdminSupabase();
    await consumeCommentRateLimit(supabase, walletAddress);
    await validateUploadedMedia({
      walletAddress,
      mediaIds: payload.mediaIds,
    });

    const { data, error: publishError } = await supabase.rpc("publish_comment_with_media", {
      p_wallet_address: walletAddress,
      p_post_id: postId,
      p_parent_id: parentId,
      p_nickname: payload.nickname,
      p_body: payload.body,
      p_media_ids: payload.mediaIds,
    });
    if (publishError) {
      throw new Error(classifyPublishError(publishError.message), { cause: publishError });
    }

    const commentId = Number((data as { id?: unknown } | null)?.id);
    if (!Number.isSafeInteger(commentId) || commentId <= 0) {
      throw new Error("COMMENT_NOT_CREATED");
    }

    revalidatePath("/");
    revalidatePath(`/p/${postId}`);
    revalidatePath(`/u/${walletAddress}`);
    after(async () => {
      await notifyIndexNow([`/p/${postId}`]);
    });
    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (error) {
    console.error("Unable to create comment", error);
    const code = error instanceof Error ? error.message : "COMMENT_NOT_CREATED";
    return commentErrorResponse(code);
  }
}
