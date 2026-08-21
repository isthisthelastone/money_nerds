import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

const MAX_LIKE_REQUEST_BYTES = 2 * 1024;
const LIKE_RATE_LIMIT = 120;
const LIKE_RATE_WINDOW_SECONDS = 60;

interface LikeBody {
  targetType?: unknown;
  targetId?: unknown;
}

function parseTarget(request: NextRequest, body?: LikeBody) {
  const targetType = String(body?.targetType ?? request.nextUrl.searchParams.get("targetType") ?? "");
  const targetId = Number(body?.targetId ?? request.nextUrl.searchParams.get("targetId"));
  if (
    (targetType !== "post" && targetType !== "comment") ||
    !Number.isSafeInteger(targetId) ||
    targetId <= 0
  ) {
    return null;
  }
  return { targetType, targetId } as const;
}

function checkDeclaredRequestSize(request: NextRequest) {
  const value = request.headers.get("content-length");
  if (!value) return;
  if (!/^\d+$/.test(value)) throw new Error("INVALID_REQUEST_BODY");
  if (Number(value) > MAX_LIKE_REQUEST_BYTES) throw new Error("REQUEST_TOO_LARGE");
}

async function readBoundedBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_LIKE_REQUEST_BYTES) {
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

async function readLikeBody(request: NextRequest): Promise<LikeBody> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) throw new Error("UNSUPPORTED_REQUEST_TYPE");
  const bytes = await readBoundedBody(request);

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("INVALID_REQUEST_BODY");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  return body as LikeBody;
}

async function consumeLikeRateLimit(
  supabase: ReturnType<typeof createAdminSupabase>,
  walletAddress: string,
) {
  const { error } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: walletAddress,
    p_action: "toggle_like",
    p_limit: LIKE_RATE_LIMIT,
    p_window_seconds: LIKE_RATE_WINDOW_SECONDS,
  });
  if (!error) return;
  if (error.message.includes("Wallet action rate limit exceeded")) {
    throw new Error("RATE_LIMITED", { cause: error });
  }
  throw new Error("RATE_LIMIT_UNAVAILABLE", { cause: error });
}

function likeErrorResponse(code: string) {
  switch (code) {
    case "REQUEST_TOO_LARGE":
      return apiError("That reaction request is too large.", 413);
    case "UNSUPPORTED_REQUEST_TYPE":
      return apiError("Send reaction details as JSON.", 415);
    case "INVALID_REQUEST_BODY":
      return apiError("Reaction details could not be read.");
    case "RATE_LIMITED":
      return apiError("You are reacting too quickly. Try again shortly.", 429);
    case "RATE_LIMIT_UNAVAILABLE":
      return apiError("Reactions are temporarily unavailable. Try again.", 503);
    case "TARGET_NOT_FOUND":
      return apiError("That post or comment no longer exists.", 404);
    default:
      return apiError("The reaction could not be saved.", 500);
  }
}

export async function GET(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return NextResponse.json({ liked: false });
  }
  const target = parseTarget(request);
  if (!target) return apiError("Invalid like target.");

  const supabase = createAdminSupabase();
  let query = supabase.from("likes").select("id").eq("wallet_address", walletAddress);
  query = target.targetType === "post"
    ? query.eq("post_id", target.targetId)
    : query.eq("comment_id", target.targetId);
  const { data, error } = await query.maybeSingle();
  if (error) return apiError("Like status could not be loaded.", 500);
  return NextResponse.json({ liked: Boolean(data) });
}

export async function POST(request: NextRequest) {
  try {
    checkDeclaredRequestSize(request);
  } catch (error) {
    return likeErrorResponse(error instanceof Error ? error.message : "INVALID_REQUEST_BODY");
  }

  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const body = await readLikeBody(request);
    const target = parseTarget(request, body);
    if (!target) return apiError("Invalid like target.");

    const supabase = createAdminSupabase();
    await consumeLikeRateLimit(supabase, walletAddress);
    const { data, error } = await supabase.rpc("toggle_like_for_wallet", {
      p_wallet_address: walletAddress,
      p_post_id: target.targetType === "post" ? target.targetId : null,
      p_comment_id: target.targetType === "comment" ? target.targetId : null,
    });
    if (error) {
      const code = error.message.includes("does not exist") ? "TARGET_NOT_FOUND" : "TOGGLE_FAILED";
      throw new Error(code, { cause: error });
    }

    revalidatePath("/");
    if (target.targetType === "post") revalidatePath(`/p/${target.targetId}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unable to toggle like", error);
    return likeErrorResponse(error instanceof Error ? error.message : "TOGGLE_FAILED");
  }
}
