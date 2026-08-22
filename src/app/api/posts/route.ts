import { revalidatePath } from "next/cache";
import { after, NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import { notifyIndexNow } from "@/lib/indexnow";
import {
  parseComposerPayload,
  validateUploadedMedia,
} from "@/lib/media/server";
import { isPostCategory } from "@/lib/models";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_COMPOSER_REQUEST_BYTES = 32 * 1024;
const POST_RATE_LIMIT = 10;
const POST_RATE_WINDOW_SECONDS = 60 * 60;

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

  const expectedFields = ["nickname", "body", "category", "mediaIds"];
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
    throw new Error("INVALID_CATEGORY");
  }
  if (String(formData.get("mediaIds") ?? "[]").length > 256) {
    throw new Error("INVALID_MEDIA_METADATA");
  }
  return formData;
}

async function consumePostRateLimit(
  supabase: ReturnType<typeof createAdminSupabase>,
  walletAddress: string,
) {
  const { error } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: walletAddress,
    p_action: "publish_post",
    p_limit: POST_RATE_LIMIT,
    p_window_seconds: POST_RATE_WINDOW_SECONDS,
  });
  if (!error) return;
  if (error.message.includes("Wallet action rate limit exceeded")) {
    throw new Error("RATE_LIMITED", { cause: error });
  }
  throw new Error("RATE_LIMIT_UNAVAILABLE", { cause: error });
}

function classifyPublishError(message: string) {
  if (message.includes("Media is missing, expired, or already published")) {
    return "MEDIA_UPLOAD_EXPIRED";
  }
  if (message.includes("Invalid category")) return "INVALID_CATEGORY";
  if (message.includes("Invalid nickname")) return "NICKNAME_REQUIRED";
  if (message.includes("Invalid post body")) return "MESSAGE_REQUIRED";
  if (message.includes("Invalid media list")) return "INVALID_MEDIA_METADATA";
  return "POST_NOT_CREATED";
}

function postErrorResponse(code: string) {
  const responses: Record<string, { message: string; status: number }> = {
    REQUEST_TOO_LARGE: { message: "That post request is too large.", status: 413 },
    UNSUPPORTED_REQUEST_TYPE: { message: "Send post details as form data.", status: 415 },
    INVALID_REQUEST_BODY: { message: "Post details could not be read.", status: 400 },
    NICKNAME_REQUIRED: { message: "Add a nickname for this post.", status: 400 },
    NICKNAME_TOO_LONG: { message: "Keep your nickname to 50 characters.", status: 400 },
    MESSAGE_REQUIRED: { message: "Write something or attach media.", status: 400 },
    MESSAGE_TOO_LONG: { message: "Keep your post to 5,000 characters.", status: 400 },
    INVALID_CATEGORY: { message: "Choose a valid post category.", status: 400 },
    TOO_MANY_FILES: { message: "Attach no more than four files.", status: 400 },
    INVALID_MEDIA: { message: "Use an image, audio file, or video up to 15 MB.", status: 400 },
    INVALID_MEDIA_KIND: { message: "One attachment type did not match its file.", status: 400 },
    INVALID_MEDIA_METADATA: { message: "Attachment details could not be read.", status: 400 },
    INVALID_MEDIA_OWNER: { message: "One attachment does not belong to this wallet.", status: 403 },
    MEDIA_ALREADY_USED: { message: "One attachment has already been published.", status: 409 },
    MEDIA_UPLOAD_EXPIRED: { message: "One attachment expired. Attach it again.", status: 410 },
    MEDIA_UPLOAD_INCOMPLETE: { message: "One attachment did not finish uploading.", status: 409 },
    INVALID_MEDIA_CONTENT: { message: "One attachment's contents do not match its file type.", status: 415 },
    RATE_LIMITED: { message: "You are posting too quickly. Try again later.", status: 429 },
    RATE_LIMIT_UNAVAILABLE: { message: "Posting is temporarily unavailable. Try again.", status: 503 },
    POST_NOT_CREATED: { message: "Your post could not be published.", status: 500 },
  };
  const response = responses[code] ?? responses.POST_NOT_CREATED;
  return apiError(response.message, response.status);
}

export async function POST(request: NextRequest) {
  try {
    checkDeclaredRequestSize(request);
  } catch (error) {
    return postErrorResponse(error instanceof Error ? error.message : "INVALID_REQUEST_BODY");
  }

  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const formData = await readComposerFormData(request);
    const payload = parseComposerPayload(formData);
    if (!isPostCategory(payload.category)) {
      return apiError("Choose a valid post category.");
    }

    const supabase = createAdminSupabase();
    await consumePostRateLimit(supabase, walletAddress);
    await validateUploadedMedia({
      walletAddress,
      mediaIds: payload.mediaIds,
    });

    const { data, error: publishError } = await supabase.rpc("publish_post_with_media", {
      p_wallet_address: walletAddress,
      p_nickname: payload.nickname,
      p_body: payload.body,
      p_category: payload.category,
      p_media_ids: payload.mediaIds,
    });
    if (publishError) {
      throw new Error(classifyPublishError(publishError.message), { cause: publishError });
    }

    const postId = Number((data as { id?: unknown } | null)?.id);
    if (!Number.isSafeInteger(postId) || postId <= 0) throw new Error("POST_NOT_CREATED");

    revalidatePath("/");
    revalidatePath(`/u/${walletAddress}`);
    after(async () => {
      await notifyIndexNow(["/", `/p/${postId}`, `/?category=${payload.category}`]);
    });
    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (error) {
    console.error("Unable to create post", error);
    const code = error instanceof Error ? error.message : "POST_NOT_CREATED";
    return postErrorResponse(code);
  }
}
