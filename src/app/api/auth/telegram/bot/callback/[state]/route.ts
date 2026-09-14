import { NextResponse, type NextRequest } from "next/server";
import { checkExternalAuthRateLimit } from "@/lib/auth/external";
import { isTelegramBotToken, telegramBotConfiguration, telegramBotHash, telegramBotResponse, telegramBotReturnUrl, telegramBotToken, verifyTelegramBotCallback } from "@/lib/auth/telegram-bot";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ state: string }> }) {
  const config = telegramBotConfiguration();
  if (!config) return telegramBotResponse({ error: "Bot-assisted login is unavailable. Start again on Money Nerds." }, 503);
  const { state: combinedState } = await context.params;
  const [state, nonce, extra] = combinedState.split(".");
  if (extra || !isTelegramBotToken(state) || !isTelegramBotToken(nonce) || request.url.length > 8192) {
    return telegramBotResponse({ error: "This sign-in link is invalid. Start a fresh login on Money Nerds." }, 400);
  }
  const telegram = verifyTelegramBotCallback(request.nextUrl.searchParams, config.botToken);
  if (!telegram) return telegramBotResponse({ error: "Telegram approval was declined, expired or could not be verified. Start a fresh login on Money Nerds." }, 401);
  try {
    const rate = await checkExternalAuthRateLimit(request, "external_auth_callback", 30);
    if (!rate.ok) return telegramBotResponse({ error: "Please wait a minute and start a fresh login." }, rate.limited ? 429 : 503);
    const claim = telegramBotToken();
    const { data, error } = await createAdminSupabase().rpc("approve_telegram_bot_attempt", {
      p_state_hash: telegramBotHash(state), p_callback_hash: telegramBotHash(nonce), p_sender: telegram.id,
      p_auth_date: new Date(Number(telegram.auth_date) * 1000).toISOString(),
      p_auth_hash: telegramBotHash(telegram.hash), p_return_claim_hash: telegramBotHash(claim),
      p_first_name: telegram.first_name ?? null, p_last_name: telegram.last_name ?? null,
    });
    if (error || data !== true) return telegramBotResponse({ error: "This approval is expired or already used. Return to your browser or start a fresh login." }, 409);
    const response = NextResponse.redirect(telegramBotReturnUrl(config.origin, state, claim), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    console.info("telegram_bot_auth", { event: "identity_approved" });
    return response;
  } catch {
    console.error("telegram_bot_auth", { event: "approval_failed" });
    return telegramBotResponse({ error: "Could not finish this approval. Start a fresh login on Money Nerds." }, 503);
  }
}
