import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  createExternalAuthTransaction,
  encodeExternalAuthTransaction,
  externalTransactionCookieOptions,
  getExternalAuthOrigin,
  getExternalProviderAvailability,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
    const authUrl = `${getExternalAuthOrigin()}/api/auth/telegram/callback/${encodeURIComponent(transaction.state)}`;
    const response = NextResponse.json({
      provider: "telegram",
      authUrl,
      botUsername: availability.botUsername,
      expiresAt: new Date(transaction.createdAt + 10 * 60 * 1_000).toISOString(),
    });
    response.cookies.set(
      TELEGRAM_TRANSACTION_COOKIE,
      encodeExternalAuthTransaction(transaction),
      externalTransactionCookieOptions("/api/auth/telegram"),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiError("Telegram login is not configured correctly.", 503);
  }
}
