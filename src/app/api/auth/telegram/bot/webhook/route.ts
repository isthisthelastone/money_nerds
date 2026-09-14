import type { NextRequest } from "next/server";
import { constantTimeStringEqual } from "@/lib/auth/external-core";
import { isTelegramBotToken, telegramBotConfiguration, telegramBotHash, telegramBotResponse, telegramBotToken } from "@/lib/auth/telegram-bot";
import { readBoundedJsonBody } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BotUpdate = {
  update_id?: unknown;
  message?: { text?: unknown; date?: unknown; from?: { id?: unknown; is_bot?: unknown }; chat?: { id?: unknown; type?: unknown } };
};

export async function POST(request: NextRequest) {
  const config = telegramBotConfiguration();
  if (!config) return telegramBotResponse({ error: "Unavailable" }, 503);
  if (!constantTimeStringEqual(request.headers.get("x-telegram-bot-api-secret-token") ?? "", config.webhookSecret)) {
    return telegramBotResponse({ error: "Unauthorized" }, 401);
  }
  let update: BotUpdate;
  try {
    update = await readBoundedJsonBody(request, 32768);
    if (!update || typeof update !== "object" || !Number.isSafeInteger(update.update_id) || Number(update.update_id) < 0) throw new Error("Invalid update");
  } catch { return telegramBotResponse({ error: "Invalid update" }, 400); }
  const message = update.message;
  if (!message || message.chat?.type !== "private" || message.from?.is_bot !== false ||
      !Number.isSafeInteger(message.from.id) || Number(message.from.id) < 1 || message.chat.id !== message.from.id ||
      typeof message.text !== "string" || !Number.isSafeInteger(message.date)) return telegramBotResponse({ ok: true });
  const parts = message.text.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();
  if (parts.length !== 2 || (command !== "/start" && command !== `/start@${config.botUsername.toLowerCase()}`) || !isTelegramBotToken(parts[1])) {
    return telegramBotResponse({ ok: true });
  }
  const state = parts[1];
  const sender = String(message.from.id);
  const supabase = createAdminSupabase();
  let acquired = false;
  try {
    const claim = await supabase.rpc("claim_telegram_bot_update", { p_update_id: update.update_id });
    if (claim.error) throw new Error("Update claim unavailable");
    if (claim.data === "done") return telegramBotResponse({ ok: true });
    if (claim.data !== "acquired") return telegramBotResponse({ error: "Retry later" }, 503);
    acquired = true;
    const nonce = telegramBotToken();
    const binding = await supabase.rpc("bind_telegram_bot_sender", {
      p_state_hash: telegramBotHash(state), p_sender: sender, p_callback_hash: telegramBotHash(nonce),
      p_message_date: new Date(Number(message.date) * 1000).toISOString(),
    });
    if (binding.error) throw new Error("Sender binding unavailable");
    if (binding.data === true) {
      const callbackUrl = new URL(`/api/auth/telegram/bot/callback/${state}.${nonce}`, config.origin);
      const delivery = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          chat_id: message.chat.id,
          text: "Sign in to Money Nerds\n\nOnly continue if you just started this login yourself on moneynerds.online. Never approve a login link sent by someone else. After approval, use the return page to go back to the browser where you started. This request expires in 10 minutes.",
          protect_content: true,
          reply_markup: { inline_keyboard: [[{ text: "Approve and return to Money Nerds", login_url: {
            url: callbackUrl.href, bot_username: config.botUsername, request_write_access: false,
            forward_text: "Do not use forwarded sign-in links",
          } }]] },
        }),
      });
      const result = await delivery.json() as { ok?: unknown };
      if (!delivery.ok || result.ok !== true) throw new Error("Bot delivery failed");
      console.info("telegram_bot_auth", { event: "login_button_sent" });
    }
    const completed = await supabase.from("telegram_bot_webhook_updates").update({ completed: true }).eq("update_id", update.update_id);
    if (completed.error) throw new Error("Update completion unavailable");
    return telegramBotResponse({ ok: true });
  } catch {
    if (acquired) await supabase.from("telegram_bot_webhook_updates").delete().eq("update_id", update.update_id).eq("completed", false);
    console.error("telegram_bot_auth", { event: "webhook_failed" });
    return telegramBotResponse({ error: "Retry later" }, 503);
  }
}
