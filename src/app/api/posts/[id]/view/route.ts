import { createHash, randomUUID } from "node:crypto";
import bs58 from "bs58";
import { NextResponse, type NextRequest } from "next/server";
import { getWalletSession } from "@/lib/auth/server";
import { apiError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

const VIEWER_COOKIE = "mn_viewer";
const VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

function requestSourceKey(request: NextRequest) {
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const digest = createHash("sha256")
    .update(`money-nerds-post-view-source:${sourceIp}`)
    .digest();
  return bs58.encode(digest);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const postId = Number((await params).id);
  if (!Number.isSafeInteger(postId) || postId <= 0) {
    return apiError("Post not found.", 404);
  }

  const existingViewerId = request.cookies.get(VIEWER_COOKIE)?.value ?? "";
  const viewerId = UUID_PATTERN.test(existingViewerId) ? existingViewerId : randomUUID();
  const session = await getWalletSession();
  const viewerIdentity = session
    ? `wallet:${session.walletAddress}`
    : `browser:${viewerId}`;
  const viewerHash = createHash("sha256")
    .update(`money-nerds-post-view:v1:${viewerIdentity}`)
    .digest("hex");

  const supabase = createAdminSupabase();
  const { error: rateError } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: requestSourceKey(request),
    p_action: "post_view",
    p_limit: 300,
    p_window_seconds: 3600,
  });
  if (rateError) {
    const limited = rateError.message.includes("Wallet action rate limit exceeded");
    if (!limited) console.error("Unable to rate-limit post view", rateError);
    return apiError(
      limited ? "Too many posts were opened from this connection." : "The view could not be recorded.",
      limited ? 429 : 503,
    );
  }

  const { data, error } = await supabase.rpc("record_unique_post_view", {
    p_post_id: postId,
    p_viewer_hash: viewerHash,
  });
  if (error) {
    if (error.message.includes("Post not found")) return apiError("Post not found.", 404);
    console.error("Unable to record post view", error);
    return apiError("The view could not be recorded.", 503);
  }

  const response = NextResponse.json({ viewCount: Number(data ?? 0) });
  if (!UUID_PATTERN.test(existingViewerId)) {
    response.cookies.set(VIEWER_COOKIE, viewerId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: VIEWER_COOKIE_MAX_AGE,
    });
  }
  return response;
}
