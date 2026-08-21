import bs58 from "bs58";
import nacl from "tweetnacl";
import { NextResponse, type NextRequest } from "next/server";
import {
  createOpaqueSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/config";
import { apiError, readBoundedJsonBody, RequestBodyError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeWallet } from "@/lib/wallet";

interface VerifyBody {
  challengeId?: unknown;
  walletAddress?: unknown;
  signature?: unknown;
}

export async function POST(request: NextRequest) {
  let body: VerifyBody | null = null;
  try {
    body = await readBoundedJsonBody<VerifyBody>(request, 2_048);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The sign-in response is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send the wallet signature as JSON.", 415);
    }
    return apiError("The sign-in response could not be read.");
  }
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  const walletAddress = normalizeWallet(body?.walletAddress);
  const signature = typeof body?.signature === "string" ? body.signature : "";

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId) ||
    !walletAddress ||
    signature.length < 80 ||
    signature.length > 100
  ) {
    return apiError("The wallet sign-in response is incomplete.");
  }

  const supabase = createAdminSupabase();
  const { data: challenge, error: challengeError } = await supabase
    .from("wallet_challenges")
    .select("id, wallet_address, message, expires_at, consumed_at, attempt_count")
    .eq("id", challengeId)
    .eq("wallet_address", walletAddress)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .lt("attempt_count", 9)
    .maybeSingle();

  if (challengeError || !challenge) {
    return apiError("This sign-in request expired or was already used.", 401);
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("wallet_challenges")
    .update({ attempt_count: Number(challenge.attempt_count) + 1 })
    .eq("id", challengeId)
    .eq("attempt_count", challenge.attempt_count)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (attemptError || !attempt) {
    return apiError("This sign-in request is already being checked. Try again.", 409);
  }

  try {
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(challenge.message as string),
      bs58.decode(signature),
      bs58.decode(walletAddress),
    );
    if (!isValid) return apiError("The wallet signature is invalid.", 401);
  } catch {
    return apiError("The wallet signature could not be read.", 401);
  }

  const token = createOpaqueSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const { error: sessionError } = await supabase.rpc("establish_wallet_session", {
    p_challenge_id: challengeId,
    p_wallet_address: walletAddress,
    p_token_hash: hashSessionToken(token),
    p_session_expires_at: expiresAt.toISOString(),
  });
  if (sessionError) {
    console.error("Unable to create wallet session", sessionError);
    return apiError("This sign-in request expired or was already used.", 409);
  }

  const response = NextResponse.json({
    walletAddress,
    expiresAt: expiresAt.toISOString(),
  });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
}
