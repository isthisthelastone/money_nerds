import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  clearExternalTransactionCookie,
  decodeExternalAuthTransaction,
  externalAuthRedirect,
  getExternalProviderAvailability,
  TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY,
  TELEGRAM_OIDC_NONCE_STORAGE_KEY,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import { constantTimeStringEqual } from "@/lib/auth/external-core";
import { createTelegramClerkSignIn } from "@/lib/auth/telegram-clerk";
import { exchangeTelegramOidcCode } from "@/lib/auth/telegram-oidc";

export const dynamic = "force-dynamic";

function clearTransaction(response: NextResponse) {
  clearExternalTransactionCookie(response, TELEGRAM_TRANSACTION_COOKIE, "/api/auth/telegram");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function errorRedirect(returnTo: string, code: string) {
  return clearTransaction(
    NextResponse.redirect(externalAuthRedirect(returnTo, "error", code), 303),
  );
}

export async function GET(request: NextRequest) {
  if (request.url.length > 4_096) return errorRedirect("/", "invalid_callback");

  const availability = getExternalProviderAvailability("telegram");
  if (!availability.available || availability.telegramFlow !== "oidc") {
    return errorRedirect("/", "provider_unavailable");
  }

  let transaction;
  try {
    transaction = decodeExternalAuthTransaction(
      request.cookies.get(TELEGRAM_TRANSACTION_COOKIE)?.value,
    );
  } catch {
    return errorRedirect("/", "provider_unavailable");
  }
  const returnTo = transaction?.returnTo ?? "/";
  const state = request.nextUrl.searchParams.get("state");
  const codeVerifier = transaction?.authStorage[TELEGRAM_OIDC_CODE_VERIFIER_STORAGE_KEY];
  const nonce = transaction?.authStorage[TELEGRAM_OIDC_NONCE_STORAGE_KEY];
  if (
    !transaction ||
    transaction.provider !== "telegram" ||
    !state ||
    !constantTimeStringEqual(transaction.state, state) ||
    transaction.createdAt > Date.now() + 30_000 ||
    transaction.createdAt < Date.now() - 10 * 60 * 1_000 ||
    typeof codeVerifier !== "string" ||
    typeof nonce !== "string"
  ) {
    return errorRedirect(returnTo, "invalid_callback");
  }

  if (request.nextUrl.searchParams.has("error")) {
    return errorRedirect(returnTo, "cancelled");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return errorRedirect(returnTo, "invalid_callback");

  const rate = await checkExternalAuthRateLimit(request, "external_auth_callback", 30);
  if (!rate.ok) {
    return errorRedirect(
      returnTo,
      rate.limited ? "too_many_requests" : "temporarily_unavailable",
    );
  }

  const exchanged = await exchangeTelegramOidcCode(code, codeVerifier, nonce);
  if (!exchanged.ok) return errorRedirect(returnTo, exchanged.code);

  try {
    const signInUrl = await createTelegramClerkSignIn(
      {
        // Keep the existing `telegram:<Bot API user id>` Clerk identity so
        // users who signed in through the legacy widget are not duplicated.
        subject: exchanged.identity.telegramUserId,
        firstName: exchanged.identity.firstName,
        lastName: exchanged.identity.lastName,
      },
      returnTo,
    );
    return clearTransaction(NextResponse.redirect(signInUrl, 303));
  } catch {
    return errorRedirect(returnTo, "temporarily_unavailable");
  }
}
