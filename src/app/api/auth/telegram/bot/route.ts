import type { NextRequest } from "next/server";
import { checkExternalAuthRateLimit } from "@/lib/auth/external";
import { createTelegramBotAttempt, setTelegramBotCookie, telegramBotConfiguration, telegramBotResponse, telegramBotSameOrigin } from "@/lib/auth/telegram-bot";
import { readBoundedJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return telegramBotResponse({ available: Boolean(telegramBotConfiguration()) });
}

export async function POST(request: NextRequest) {
  const config = telegramBotConfiguration();
  if (!config) return telegramBotResponse({ error: "Bot-assisted login is unavailable. Use Continue with Telegram." }, 503);
  if (!telegramBotSameOrigin(request, config.origin)) return telegramBotResponse({ error: "Start sign-in on Money Nerds." }, 403);
  let body: { returnTo?: unknown };
  try {
    body = await readBoundedJsonBody(request, 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
  } catch { return telegramBotResponse({ error: "Send login details as JSON." }, 400); }
  try {
    const rate = await checkExternalAuthRateLimit(request, "external_auth_start", 10);
    if (!rate.ok) return telegramBotResponse({ error: "Please wait a minute before starting another login." }, rate.limited ? 429 : 503);
    const attempt = await createTelegramBotAttempt(body.returnTo);
    const authUrl = new URL(`https://t.me/${config.botUsername}`);
    authUrl.searchParams.set("start", attempt.state);
    const response = telegramBotResponse({ flow: "bot", authUrl: authUrl.href, expiresAt: attempt.expiresAt });
    setTelegramBotCookie(response, attempt.state, attempt.browserSecret);
    console.info("telegram_bot_auth", { event: "start_issued" });
    return response;
  } catch {
    console.error("telegram_bot_auth", { event: "start_failed" });
    return telegramBotResponse({ error: "Bot-assisted login is temporarily unavailable. Use Continue with Telegram." }, 503);
  }
}
