import { createHash, randomBytes, randomUUID } from "node:crypto";
import bs58 from "bs58";
import { NextResponse, type NextRequest } from "next/server";
import { SERVICE_WALLET } from "@/lib/config";
import { apiError, readBoundedJsonBody, RequestBodyError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeWallet } from "@/lib/wallet";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function trustedOrigin(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const hostname = request.nextUrl.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "moneynerds.online" ||
    hostname === "www.moneynerds.online" ||
    hostname.endsWith(".vercel.app")
  ) {
    return origin;
  }
  return "https://www.moneynerds.online";
}

export async function POST(request: NextRequest) {
  let body: { walletAddress?: unknown } | null = null;
  try {
    body = await readBoundedJsonBody<{ walletAddress?: unknown }>(request, 512);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The sign-in request is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send wallet sign-in details as JSON.", 415);
    }
    return apiError("The sign-in request could not be read.");
  }
  const walletAddress = normalizeWallet(body?.walletAddress);
  if (!walletAddress) return apiError("Enter a valid Solana wallet address.");

  const id = randomUUID();
  const nonce = randomBytes(18).toString("base64url");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
  const sourceIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const sourceDigest = createHash("sha256")
    .update(`money-nerds-auth:${sourceIp}`)
    .digest();
  const requestFingerprint = sourceDigest.toString("hex");
  const sourceRateKey = bs58.encode(sourceDigest);
  const origin = trustedOrigin(request);
  const domain = new URL(origin).host;
  const message = `${domain} wants you to sign in with your Solana account:\n${walletAddress}\n\nSign in to Money Nerds. This request will not trigger a blockchain transaction or cost SOL.\n\nURI: ${origin}\nVersion: 1\nChain ID: mainnet-beta\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}\nRequest ID: ${id}`;

  const supabase = createAdminSupabase();
  const rateResults = await Promise.all([
    supabase.rpc("consume_wallet_rate_limit", {
      p_wallet_address: walletAddress,
      p_action: "auth_challenge",
      p_limit: 5,
      p_window_seconds: 60,
    }),
    supabase.rpc("consume_wallet_rate_limit", {
      p_wallet_address: sourceRateKey,
      p_action: "auth_source",
      p_limit: 20,
      p_window_seconds: 60,
    }),
    supabase.rpc("consume_wallet_rate_limit", {
      p_wallet_address: SERVICE_WALLET,
      p_action: "auth_global",
      p_limit: 300,
      p_window_seconds: 60,
    }),
  ]);
  const rateError = rateResults.find((result) => result.error)?.error;
  if (rateError) {
    const limited = rateError.message.includes("Wallet action rate limit exceeded");
    if (!limited) console.error("Unable to check wallet sign-in rate", rateError);
    return apiError(
      limited
        ? "Too many sign-in requests. Wait a minute and try again."
        : "Wallet sign-in is temporarily unavailable. Please try again.",
      limited ? 429 : 503,
    );
  }

  const { error } = await supabase.from("wallet_challenges").insert({
    id,
    wallet_address: walletAddress,
    message,
    expires_at: expiresAt.toISOString(),
    request_fingerprint: requestFingerprint,
  });

  if (error) {
    console.error("Unable to create wallet challenge", error);
    return apiError("Could not start wallet sign-in. Please try again.", 500);
  }

  await supabase.rpc("prune_expired_private_rows");

  return NextResponse.json({ id, message, expiresAt: expiresAt.toISOString() });
}
