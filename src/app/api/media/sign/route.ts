import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import {
  cleanupExpiredStagedMedia,
  cleanupUploadedMedia,
  createSignedMediaUploads,
  validateMediaUploadRequest,
} from "@/lib/media/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_SIGN_REQUEST_BYTES = 16 * 1024;
const MAX_CLEANUP_REQUEST_BYTES = 4 * 1024;
const MEDIA_SIGN_RATE_LIMIT = 30;
const MEDIA_SIGN_RATE_WINDOW_SECONDS = 60 * 60;
const MEDIA_CLEANUP_RATE_LIMIT = 120;
const MEDIA_CLEANUP_RATE_WINDOW_SECONDS = 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkDeclaredRequestSize(request: NextRequest, maximum: number) {
  const value = request.headers.get("content-length");
  if (!value) return;
  if (!/^\d+$/.test(value)) throw new Error("INVALID_REQUEST_BODY");
  if (Number(value) > maximum) throw new Error("REQUEST_TOO_LARGE");
}

async function readBoundedBody(request: NextRequest, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => undefined);
        throw new Error("REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readBoundedJson(request: NextRequest, maximum: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw new Error("UNSUPPORTED_REQUEST_TYPE");
  const bytes = await readBoundedBody(request, maximum);

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("INVALID_REQUEST_BODY");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  return body as Record<string, unknown>;
}

async function consumeMediaRateLimit({
  walletAddress,
  action,
  limit,
  windowSeconds,
}: {
  walletAddress: string;
  action: "prepare_media" | "discard_media";
  limit: number;
  windowSeconds: number;
}) {
  const supabase = createAdminSupabase();
  const { error } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: walletAddress,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (!error) return;
  if (error.message.includes("Wallet action rate limit exceeded")) {
    throw new Error("RATE_LIMITED", { cause: error });
  }
  throw new Error("RATE_LIMIT_UNAVAILABLE", { cause: error });
}

function mediaErrorResponse(code: string, operation: "sign" | "cleanup") {
  const responses: Record<string, { message: string; status: number }> = {
    REQUEST_TOO_LARGE: { message: "That attachment request is too large.", status: 413 },
    UNSUPPORTED_REQUEST_TYPE: { message: "Send attachment details as JSON.", status: 415 },
    INVALID_REQUEST_BODY: { message: "Attachment details could not be read.", status: 400 },
    INVALID_ATTACHMENTS: { message: "Invalid attachments.", status: 400 },
    INVALID_MEDIA: { message: "Use an image, audio file, or video up to 15 MB.", status: 400 },
    INVALID_MEDIA_KIND: { message: "One attachment type did not match its file.", status: 400 },
    TOO_MANY_FILES: { message: "Attach no more than four files.", status: 400 },
    MEDIA_QUOTA_EXCEEDED: {
      message: "You have reached the hourly attachment limit. Try again later.",
      status: 429,
    },
    RATE_LIMITED: { message: "Too many attachment requests. Try again later.", status: 429 },
    RATE_LIMIT_UNAVAILABLE: {
      message: "Attachments are temporarily unavailable. Try again.",
      status: 503,
    },
    MEDIA_CLEANUP_FAILED: {
      message: "The unfinished upload could not be cleaned up.",
      status: 500,
    },
    MEDIA_SIGN_FAILED: { message: "The upload could not be prepared.", status: 500 },
  };
  const fallback = operation === "sign" ? responses.MEDIA_SIGN_FAILED : responses.MEDIA_CLEANUP_FAILED;
  const response = responses[code] ?? fallback;
  return apiError(response.message, response.status);
}

export async function POST(request: NextRequest) {
  try {
    checkDeclaredRequestSize(request, MAX_SIGN_REQUEST_BYTES);
  } catch (error) {
    return mediaErrorResponse(error instanceof Error ? error.message : "INVALID_REQUEST_BODY", "sign");
  }

  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const body = await readBoundedJson(request, MAX_SIGN_REQUEST_BYTES);
    if (body.scope !== "posts" && body.scope !== "comments") {
      return apiError("Invalid upload destination.");
    }
    if (!Array.isArray(body.files) || body.files.length < 1) {
      return apiError("Choose a file to upload.");
    }
    if (body.files.length > 4) throw new Error("TOO_MANY_FILES");

    const files = body.files.map(validateMediaUploadRequest);
    await consumeMediaRateLimit({
      walletAddress,
      action: "prepare_media",
      limit: MEDIA_SIGN_RATE_LIMIT,
      windowSeconds: MEDIA_SIGN_RATE_WINDOW_SECONDS,
    });
    await cleanupExpiredStagedMedia(25).catch((cleanupError) => {
      console.error("Unable to clean up expired staged media", cleanupError);
    });
    const uploads = await createSignedMediaUploads({ walletAddress, scope: body.scope, files });
    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Unable to sign media upload", error);
    const code = error instanceof Error ? error.message : "MEDIA_SIGN_FAILED";
    return mediaErrorResponse(code, "sign");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    checkDeclaredRequestSize(request, MAX_CLEANUP_REQUEST_BYTES);
  } catch (error) {
    return mediaErrorResponse(error instanceof Error ? error.message : "INVALID_REQUEST_BODY", "cleanup");
  }

  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const body = await readBoundedJson(request, MAX_CLEANUP_REQUEST_BYTES);
    if (
      !Array.isArray(body.mediaIds) ||
      body.mediaIds.length > 4 ||
      !body.mediaIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
    ) {
      throw new Error("INVALID_ATTACHMENTS");
    }
    const mediaIds = [...new Set(body.mediaIds as string[])];
    if (!mediaIds.length) return new NextResponse(null, { status: 204 });

    await consumeMediaRateLimit({
      walletAddress,
      action: "discard_media",
      limit: MEDIA_CLEANUP_RATE_LIMIT,
      windowSeconds: MEDIA_CLEANUP_RATE_WINDOW_SECONDS,
    });
    const supabase = createAdminSupabase();
    const { data: assets, error: assetsError } = await supabase
      .from("media_assets")
      .select("id, storage_path")
      .eq("owner_wallet", walletAddress)
      .eq("status", "staged")
      .in("id", mediaIds);
    if (assetsError) throw new Error("MEDIA_CLEANUP_FAILED", { cause: assetsError });

    await cleanupUploadedMedia(
      (assets ?? []).map((asset) => ({ id: asset.id, storagePath: asset.storage_path })),
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unable to clean up media upload", error);
    const code = error instanceof Error ? error.message : "MEDIA_CLEANUP_FAILED";
    return mediaErrorResponse(code, "cleanup");
  }
}
