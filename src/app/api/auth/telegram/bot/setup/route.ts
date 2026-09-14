import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getExternalAuthOrigin, getTelegramBotToken } from "@/lib/auth/external";
import { readBoundedJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

// Temporary, authenticated deployment bootstrap. Removed after setup: Vercel's
// sensitive bot credential is deliberately never exported to the operator.
export async function POST(request: NextRequest) {
  const secret = process.env.TELEGRAM_BOT_SETUP_KEY ?? "";
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (secret.length < 32 || given.length !== secret.length ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new NextResponse(null, { status: 404 });
  }
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  try {
    const input = await readBoundedJsonBody(request, 512) as { action?: unknown };
    if (input.action !== "inspect" && input.action !== "configure") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400, headers });
    }
    const token = getTelegramBotToken();
    const call = async (method: string, body?: object) => {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}), cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!data.ok) throw new Error("Telegram rejected setup operation");
      return data.result;
    };
    const [bot, webhook] = await Promise.all([call("getMe"), call("getWebhookInfo")]);
    const url = new URL("/api/auth/telegram/bot/webhook", getExternalAuthOrigin()).href;
    if (input.action === "configure") {
      if (webhook.url && webhook.url !== url) {
        return NextResponse.json({ error: "Existing webhook must be preserved", webhookUrl: webhook.url }, { status: 409, headers });
      }
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
      if (!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret)) throw new Error("Webhook secret not configured");
      await call("setWebhook", { url, secret_token: webhookSecret, allowed_updates: ["message"], drop_pending_updates: false });
    }
    return NextResponse.json({
      ok: true, action: input.action, username: bot.username,
      webhookUrl: input.action === "configure" ? url : webhook.url,
      pendingUpdates: webhook.pending_update_count,
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Bot setup unavailable" }, { status: 503, headers });
  }
}
