import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  createExternalAuthTransaction,
  decodeExternalAuthTransaction,
  encodeExternalAuthTransaction,
  externalTransactionCookieOptions,
  getExternalAuthOrigin,
  getExternalProviderAvailability,
  TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY,
  TELEGRAM_OIDC_NONCE_STORAGE_KEY,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import { createExternalAuthState } from "@/lib/auth/external-core";
import { isTelegramNativeAuthorizationUrl } from "@/lib/auth/telegram-links";
import {
  createTelegramOidcAuthorizationUrl,
  requestTelegramNativeAuthorizationUrl,
} from "@/lib/auth/telegram-oidc";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";
const NATIVE_URL_STORAGE_KEY = "telegram_oidc_native_url";

function privateResponse(payload: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const availability = getExternalProviderAvailability("telegram");
  if (!availability.available) {
    console.warn("Telegram authentication is unavailable", { reason: availability.reason });
    return apiError("Telegram login is unavailable.", 503, {
      provider: "telegram",
      available: false,
    });
  }

  if (request.nextUrl.searchParams.get("resume") === "1") {
    try {
      const transaction = decodeExternalAuthTransaction(request.cookies.get(TELEGRAM_TRANSACTION_COOKIE)?.value);
      const codeVerifier = transaction?.authStorage[TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY];
      const nonce = transaction?.authStorage[TELEGRAM_OIDC_NONCE_STORAGE_KEY];
      if (
        availability.telegramFlow !== "oidc" || transaction?.provider !== "telegram" ||
        transaction.createdAt > Date.now() + 30_000 || transaction.createdAt < Date.now() - 10 * 60 * 1_000 ||
        typeof codeVerifier !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(codeVerifier) ||
        typeof nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(nonce)
      ) {
        return privateResponse({ error: "This Telegram sign-in has expired. Start again." }, 410);
      }
      const nativeUrl = transaction.authStorage[NATIVE_URL_STORAGE_KEY];
      return privateResponse({
        provider: "telegram",
        flow: "oidc",
        authUrl: createTelegramOidcAuthorizationUrl(transaction.state, codeVerifier, nonce).href,
        nativeUrl: isTelegramNativeAuthorizationUrl(nativeUrl) ? nativeUrl : null,
        expiresAt: new Date(transaction.createdAt + 10 * 60 * 1_000).toISOString(),
      });
    } catch {
      return privateResponse({ error: "This Telegram sign-in cannot be resumed. Start again." }, 410);
    }
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
      const codeVerifier = createExternalAuthState();
      const nonce = createExternalAuthState();
      transaction.authStorage[TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY] = codeVerifier;
      transaction.authStorage[TELEGRAM_OIDC_NONCE_STORAGE_KEY] = nonce;
      const authorizationUrl = createTelegramOidcAuthorizationUrl(transaction.state, codeVerifier, nonce);
      const nativeUrl = request.nextUrl.searchParams.get("native") === "1"
        ? await requestTelegramNativeAuthorizationUrl(authorizationUrl, request.headers.get("user-agent"))
        : null;
      if (nativeUrl) transaction.authStorage[NATIVE_URL_STORAGE_KEY] = nativeUrl;
      payload = {
        provider: "telegram",
        flow: "oidc",
        authUrl: authorizationUrl.href,
        nativeUrl,
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
    const response = privateResponse(payload);
    response.cookies.set(
      TELEGRAM_TRANSACTION_COOKIE,
      encodeExternalAuthTransaction(transaction),
      externalTransactionCookieOptions("/api/auth/telegram"),
    );
    return response;
  } catch {
    return apiError("Telegram login is not configured correctly.", 503);
  }
}
