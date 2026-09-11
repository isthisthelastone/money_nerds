import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  createExternalAuthTransaction,
  encodeExternalAuthTransaction,
  externalTransactionCookieOptions,
  getExternalAuthOrigin,
  getExternalProviderAvailability,
  getTelegramOidcConfiguration,
  TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY,
  TELEGRAM_OIDC_NONCE_STORAGE_KEY,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import { createExternalAuthState } from "@/lib/auth/external-core";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Retire the previous release's cached native attempt, including old tabs
  // still running that client bundle. A fresh start always uses Telegram /auth.
  if (request.nextUrl.searchParams.get("resume") === "1") {
    return NextResponse.json(
      { error: "Start Telegram sign-in again using the restored browser flow." },
      { status: 410, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
    );
  }
  const availability = getExternalProviderAvailability("telegram");
  if (!availability.available) {
    console.warn("Telegram authentication is unavailable", { reason: availability.reason });
    return apiError("Telegram login is unavailable.", 503, {
      provider: "telegram",
      available: false,
    });
  }

  const rate = await checkExternalAuthRateLimit(request, "external_auth_start", 15);
  if (!rate.ok) {
    return apiError(
      rate.limited ? "Too many login attempts. Wait a minute and try again." : "Login is temporarily unavailable.",
      rate.limited ? 429 : 503,
    );
  }

  try {
    const transaction = createExternalAuthTransaction("telegram", request.nextUrl.searchParams.get("returnTo"));
    let payload: Record<string, unknown>;
    if (availability.telegramFlow === "oidc") {
      const configuration = getTelegramOidcConfiguration();
      const codeVerifier = createExternalAuthState();
      const nonce = createExternalAuthState();
      transaction.authStorage[TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY] = codeVerifier;
      transaction.authStorage[TELEGRAM_OIDC_NONCE_STORAGE_KEY] = nonce;
      const authorizationUrl = new URL("https://oauth.telegram.org/auth");
      authorizationUrl.search = new URLSearchParams({
        client_id: configuration.clientId,
        redirect_uri: configuration.redirectUri,
        response_type: "code",
        scope: "openid profile",
        state: transaction.state,
        nonce,
        code_challenge: createHash("sha256").update(codeVerifier, "ascii").digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      payload = {
        provider: "telegram",
        flow: "oidc",
        authUrl: authorizationUrl.href,
        expiresAt: new Date(transaction.createdAt + 10 * 60 * 1_000).toISOString(),
      };
    } else {
      payload = {
        provider: "telegram",
        flow: "legacy",
        authUrl: `${getExternalAuthOrigin()}/api/auth/telegram/callback/${encodeURIComponent(transaction.state)}`,
        botUsername: availability.botUsername,
        expiresAt: new Date(transaction.createdAt + 10 * 60 * 1_000).toISOString(),
      };
    }
    const response = NextResponse.json(payload);
    response.cookies.set(
      TELEGRAM_TRANSACTION_COOKIE,
      encodeExternalAuthTransaction(transaction),
      externalTransactionCookieOptions("/api/auth/telegram"),
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    console.info("telegram_auth", { event: "start_issued", flow: availability.telegramFlow, transport: "provider_web" });
    return response;
  } catch {
    console.error("telegram_auth", { event: "start_failed" });
    return apiError("Telegram login is not configured correctly.", 503);
  }
}
