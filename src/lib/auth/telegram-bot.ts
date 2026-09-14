import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getExternalAuthOrigin, getTelegramBotToken } from "@/lib/auth/external";
import { constantTimeStringEqual, normalizeReturnTo, parseTelegramLoginPayload, verifyTelegramLogin } from "@/lib/auth/external-core";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const TELEGRAM_BOT_COOKIE = "__Host-mn_telegram_bot";
export const TELEGRAM_BOT_TTL = 600;
export const TELEGRAM_BOT_RETURN_PATH = "/api/auth/telegram/bot/return";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOGIN_FIELDS = new Set(["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]);

export function telegramBotConfiguration() {
  if (process.env.AUTH_TELEGRAM_BOT_ENABLED?.trim().toLowerCase() !== "true" ||
      process.env.AUTH_TELEGRAM_ENABLED?.trim().toLowerCase() !== "true") return null;
  try {
    const botToken = getTelegramBotToken();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME!.trim().replace(/^@/, "");
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret) || !process.env.CLERK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    const origin = getExternalAuthOrigin();
    if (new URL(origin).protocol !== "https:") return null;
    return { botToken, botUsername, webhookSecret, origin };
  } catch { return null; }
}

export function telegramBotToken() {
  return randomBytes(32).toString("base64url");
}

export function telegramBotHash(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isTelegramBotToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function telegramBotResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: {
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
  } });
}

export function telegramBotSameOrigin(request: NextRequest, origin: string) {
  return request.headers.get("origin") === origin && request.nextUrl.origin === origin &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}

export function setTelegramBotCookie(response: NextResponse, state: string, secret: string) {
  response.cookies.set(TELEGRAM_BOT_COOKIE, `${state}.${secret}`, {
    secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: TELEGRAM_BOT_TTL,
  });
}

export function clearTelegramBotCookie(response: NextResponse) {
  response.cookies.set(TELEGRAM_BOT_COOKIE, "", {
    secure: true, httpOnly: true, sameSite: "lax", path: "/", maxAge: 0,
  });
  return response;
}

export function telegramBotBrowserSecret(request: NextRequest, state: string) {
  const value = request.cookies.get(TELEGRAM_BOT_COOKIE)?.value ?? "";
  const [cookieState, secret, extra] = value.split(".");
  return !extra && isTelegramBotToken(cookieState) && isTelegramBotToken(secret) &&
    constantTimeStringEqual(cookieState, state) ? secret : null;
}

export async function createTelegramBotAttempt(returnTo: unknown) {
  const state = telegramBotToken();
  const browserSecret = telegramBotToken();
  const { data, error } = await createAdminSupabase().rpc("create_telegram_bot_attempt", {
    p_state_hash: telegramBotHash(state), p_browser_hash: telegramBotHash(browserSecret),
    p_return_to: normalizeReturnTo(returnTo),
  });
  if (error || typeof data !== "string") throw new Error("Bot attempt unavailable");
  return { state, browserSecret, expiresAt: data };
}

/** LoginUrl uses widget HMAC, NOT WebAppData or the existing OIDC JWT flow. */
export function verifyTelegramBotCallback(params: URLSearchParams, token: string) {
  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key) || !LOGIN_FIELDS.has(key)) return null;
    seen.add(key);
  }
  const payload = parseTelegramLoginPayload(Object.fromEntries(params));
  if (!payload || !verifyTelegramLogin(payload, token, Math.floor(Date.now() / 1000), TELEGRAM_BOT_TTL).ok) return null;
  return payload;
}

export type TelegramBotIdentity = { subject: string; firstName?: string; lastName?: string; returnTo: string };

export function readTelegramBotIdentity(value: unknown): TelegramBotIdentity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.telegram_subject !== "string" || !/^[1-9][0-9]{0,19}$/.test(record.telegram_subject)) return null;
  return {
    subject: record.telegram_subject,
    firstName: typeof record.telegram_first_name === "string" ? record.telegram_first_name : undefined,
    lastName: typeof record.telegram_last_name === "string" ? record.telegram_last_name : undefined,
    returnTo: normalizeReturnTo(record.return_to),
  };
}

export async function prepareTelegramBotIdentity(state: string, browserSecret: string, claim: string) {
  const { data, error } = await createAdminSupabase().from("telegram_bot_pending")
    .select("telegram_subject,telegram_first_name,telegram_last_name,return_to")
    .eq("state_hash", telegramBotHash(state)).eq("browser_hash", telegramBotHash(browserSecret))
    .eq("return_claim_hash", telegramBotHash(claim)).is("consumed_at", null)
    .not("approved_at", "is", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Bot confirmation unavailable");
  return readTelegramBotIdentity(data);
}

export async function consumeTelegramBotIdentity(state: string, browserSecret: string, claim: string) {
  const { data, error } = await createAdminSupabase().rpc("consume_telegram_bot_attempt", {
    p_state_hash: telegramBotHash(state), p_browser_hash: telegramBotHash(browserSecret),
    p_return_claim_hash: telegramBotHash(claim),
  });
  if (error) throw new Error("Bot confirmation unavailable");
  return readTelegramBotIdentity(data);
}

/** Return claims stay in a fragment, never in logs/query strings or status APIs. */
export function telegramBotReturnUrl(origin: string, state: string, claim: string) {
  if (!isTelegramBotToken(state) || !isTelegramBotToken(claim)) throw new Error("Invalid bot claim");
  const url = new URL(TELEGRAM_BOT_RETURN_PATH, origin);
  url.hash = new URLSearchParams({ state, claim }).toString();
  return url;
}
