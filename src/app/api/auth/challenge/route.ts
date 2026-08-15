import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/http";
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
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 512) {
    return apiError("The sign-in request is too large.", 413);
  }
  const rawBody = await request.text();
  if (rawBody.length > 512) return apiError("The sign-in request is too large.", 413);
  let body: { walletAddress?: unknown } | null = null;
  try {
    body = JSON.parse(rawBody) as { walletAddress?: unknown };
  } catch {
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
  const requestFingerprint = createHash("sha256")
    .update(`money-nerds-auth:${sourceIp}`)
    .digest("hex");
  const origin = trustedOrigin(request);
  const domain = new URL(origin).host;
  const message = `${domain} wants you to sign in with your Solana account:\n${walletAddress}\n\nSign in to Money Nerds. This request will not trigger a blockchain transaction or cost SOL.\n\nURI: ${origin}\nVersion: 1\nChain ID: mainnet-beta\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}\nRequest ID: ${id}`;

  const supabase = createAdminSupabase();
  const rateWindow = new Date(issuedAt.getTime() - 60_000).toISOString();
  const [{ count: walletAttempts }, { count: sourceAttempts }, { count: globalAttempts }] = await Promise.all([
    supabase
      .from("wallet_challenges")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", walletAddress)
      .gte("created_at", rateWindow),
    supabase
      .from("wallet_challenges")
      .select("id", { count: "exact", head: true })
      .eq("request_fingerprint", requestFingerprint)
      .gte("created_at", rateWindow),
    supabase
      .from("wallet_challenges")
      .select("id", { count: "exact", head: true })
      .gte("created_at", rateWindow),
  ]);
  if (
    (walletAttempts ?? 0) >= 5 ||
    (sourceAttempts ?? 0) >= 20 ||
    (globalAttempts ?? 0) >= 300
  ) {
    return apiError("Too many sign-in requests. Wait a minute and try again.", 429);
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

  return NextResponse.json({ id, message, expiresAt: expiresAt.toISOString() });
}
