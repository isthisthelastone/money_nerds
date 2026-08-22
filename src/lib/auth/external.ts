import "server-only";

import { createHash } from "node:crypto";
import bs58 from "bs58";
import type { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createExternalAuthState,
  deriveExternalIdentityKey,
  type ExternalAuthProvider,
  type ExternalAuthTransaction,
  isOAuthProvider,
  normalizeReturnTo,
  openExternalAuthTransaction,
  type OAuthProvider,
  sealExternalAuthTransaction,
} from "@/lib/auth/external-core";
import {
  createOpaqueSessionToken,
  getSessionToken,
  hashSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/server";
import {
  getSupabasePublishableKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  SERVICE_WALLET,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  SITE_URL,
} from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeWallet } from "@/lib/wallet";

export const OAUTH_TRANSACTION_COOKIE = "mn_oauth_transaction";
export const TELEGRAM_TRANSACTION_COOKIE = "mn_telegram_transaction";
export const EXTERNAL_AUTH_TRANSACTION_TTL_SECONDS = 10 * 60;

const ENABLE_ENV: Record<ExternalAuthProvider, string> = {
  google: "AUTH_GOOGLE_ENABLED",
  apple: "AUTH_APPLE_ENABLED",
  telegram: "AUTH_TELEGRAM_ENABLED",
};

interface MemoryAuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ExternalProviderAvailability {
  provider: ExternalAuthProvider;
  available: boolean;
  reason: string | null;
  startUrl: string;
  callbackUrl: string | null;
  botUsername?: string;
  requiresSupabaseDashboard?: boolean;
}

export class ExternalAuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalAuthConfigurationError";
  }
}

export class ExternalAuthSessionError extends Error {
  constructor() {
    super("External authentication session could not be established.");
    this.name = "ExternalAuthSessionError";
  }
}

function isEnabled(provider: ExternalAuthProvider) {
  return process.env[ENABLE_ENV[provider]]?.trim().toLowerCase() === "true";
}

function configuredExternalAuthOrigin() {
  const configured = process.env.EXTERNAL_AUTH_ORIGIN?.trim() || SITE_URL;
  try {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function sharedConfigurationProblem() {
  const secret = process.env.EXTERNAL_AUTH_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    return "EXTERNAL_AUTH_SECRET is missing or shorter than 32 bytes.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing.";
  }
  if (!configuredExternalAuthOrigin()) {
    return "EXTERNAL_AUTH_ORIGIN must be an HTTPS origin (HTTP is allowed only for localhost).";
  }
  return null;
}

function oauthConfigurationProblem() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return "A Supabase publishable or legacy anon key is missing.";
  }
  return null;
}

function telegramConfigurationProblem() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const username = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") ?? "";
  if (!/^\d{5,12}:[A-Za-z0-9_-]{30,}$/.test(token)) return "TELEGRAM_BOT_TOKEN is missing or invalid.";
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username) || !username.toLowerCase().endsWith("bot")) {
    return "TELEGRAM_BOT_USERNAME is missing or invalid.";
  }
  return null;
}

export function getExternalAuthOrigin() {
  const origin = configuredExternalAuthOrigin();
  if (!origin) throw new ExternalAuthConfigurationError("External authentication origin is not configured.");
  return origin;
}

export function getExternalAuthSecret() {
  const secret = process.env.EXTERNAL_AUTH_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new ExternalAuthConfigurationError("External authentication secret is not configured.");
  }
  return secret;
}

export function getTelegramBotToken() {
  const status = getExternalProviderAvailability("telegram");
  if (!status.available) throw new ExternalAuthConfigurationError(status.reason ?? "Telegram login is unavailable.");
  return process.env.TELEGRAM_BOT_TOKEN!.trim();
}

export function getExternalProviderAvailability(provider: ExternalAuthProvider): ExternalProviderAvailability {
  const origin = configuredExternalAuthOrigin();
  const callbackUrl = origin
    ? provider === "telegram"
      ? `${origin}/api/auth/telegram/callback/{state}`
      : `${origin}/api/auth/oauth/${provider}/callback/{state}`
    : null;
  const base: ExternalProviderAvailability = {
    provider,
    available: false,
    reason: null,
    startUrl: provider === "telegram" ? "/api/auth/telegram" : `/api/auth/oauth/${provider}`,
    callbackUrl,
  };

  if (!isEnabled(provider)) {
    return { ...base, reason: `${ENABLE_ENV[provider]} is not enabled.` };
  }
  const problem = sharedConfigurationProblem() || (isOAuthProvider(provider) ? oauthConfigurationProblem() : telegramConfigurationProblem());
  if (problem) return { ...base, reason: problem };

  if (provider === "telegram") {
    return {
      ...base,
      available: true,
      botUsername: process.env.TELEGRAM_BOT_USERNAME!.trim().replace(/^@/, ""),
    };
  }
  return { ...base, available: true, requiresSupabaseDashboard: true };
}

export function requireExternalProvider(provider: ExternalAuthProvider) {
  const status = getExternalProviderAvailability(provider);
  if (!status.available) throw new ExternalAuthConfigurationError(status.reason ?? `${provider} login is unavailable.`);
  return status;
}

export function oauthCallbackUrl(provider: OAuthProvider, state: string) {
  return `${getExternalAuthOrigin()}/api/auth/oauth/${provider}/callback/${encodeURIComponent(state)}`;
}

export function createMemoryAuthStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  const storage: MemoryAuthStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return {
    storage,
    snapshot: () => Object.fromEntries(values),
  };
}

export function createPkceSupabase(storage: MemoryAuthStorage) {
  return createClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "pkce",
      persistSession: true,
      storage,
    },
  });
}

export function createExternalAuthTransaction(
  provider: ExternalAuthProvider,
  returnTo: unknown,
  authStorage: Record<string, string> = {},
): ExternalAuthTransaction {
  return {
    version: 1,
    provider,
    state: createExternalAuthState(),
    createdAt: Date.now(),
    returnTo: normalizeReturnTo(returnTo),
    authStorage,
  };
}

export function encodeExternalAuthTransaction(transaction: ExternalAuthTransaction) {
  const encoded = sealExternalAuthTransaction(transaction, getExternalAuthSecret());
  if (encoded.length > 3_600) throw new Error("External authentication transaction is too large.");
  return encoded;
}

export function decodeExternalAuthTransaction(value: string | undefined) {
  if (!value || value.length > 3_600) return null;
  return openExternalAuthTransaction(value, getExternalAuthSecret());
}

export function externalTransactionCookieOptions(path: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: EXTERNAL_AUTH_TRANSACTION_TTL_SECONDS,
  };
}

export function clearExternalTransactionCookie(
  response: NextResponse,
  name: string,
  path: string,
) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path,
    expires: new Date(0),
    maxAge: 0,
  });
}

export function externalAuthRedirect(returnTo: unknown, result: "success" | "error", code: string) {
  const destination = new URL(normalizeReturnTo(returnTo), getExternalAuthOrigin());
  destination.searchParams.set(result === "success" ? "auth" : "auth_error", code);
  return destination;
}

export function externalAuthSourceKey(request: NextRequest) {
  const source =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return bs58.encode(createHash("sha256").update(`money-nerds:external-auth-source:v1:${source}`).digest());
}

export async function checkExternalAuthRateLimit(
  request: NextRequest,
  action: "external_auth_start" | "external_auth_callback",
  sourceLimit: number,
) {
  const supabase = createAdminSupabase();
  const results = await Promise.all([
    supabase.rpc("consume_wallet_rate_limit", {
      p_wallet_address: externalAuthSourceKey(request),
      p_action: action,
      p_limit: sourceLimit,
      p_window_seconds: 60,
    }),
    supabase.rpc("consume_wallet_rate_limit", {
      p_wallet_address: SERVICE_WALLET,
      p_action: `${action}_global`,
      p_limit: 300,
      p_window_seconds: 60,
    }),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (!error) return { ok: true as const };
  return {
    ok: false as const,
    limited: error.message.includes("rate limit"),
  };
}

export async function checkExternalIdentityRateLimit(proxyWalletAddress: string) {
  const supabase = createAdminSupabase();
  const { error } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: proxyWalletAddress,
    p_action: "external_auth_identity",
    p_limit: 8,
    p_window_seconds: 300,
  });
  if (!error) return { ok: true as const };
  return { ok: false as const, limited: error.message.includes("rate limit") };
}

export async function establishExternalSession(provider: ExternalAuthProvider, subject: string) {
  requireExternalProvider(provider);
  const identity = deriveExternalIdentityKey(provider, subject, getExternalAuthSecret());
  const identityRate = await checkExternalIdentityRateLimit(identity.proxyWalletAddress);
  if (!identityRate.ok) throw new ExternalAuthSessionError();

  const token = createOpaqueSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1_000);
  const previousToken = await getSessionToken();
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("establish_external_session", {
    p_provider: provider,
    p_subject_hash: identity.subjectHash,
    p_proxy_wallet_address: identity.proxyWalletAddress,
    p_token_hash: hashSessionToken(token),
    p_session_expires_at: expiresAt.toISOString(),
    p_previous_token_hash: previousToken ? hashSessionToken(previousToken) : null,
  });
  const result = data as
    | { wallet_address?: unknown; expires_at?: unknown; auth_provider?: unknown }
    | null;
  const walletAddress = normalizeWallet(result?.wallet_address);
  if (
    error ||
    !walletAddress ||
    typeof result?.expires_at !== "string" ||
    result.auth_provider !== provider
  ) {
    if (error) console.error("Unable to establish external session", { code: error.code });
    throw new ExternalAuthSessionError();
  }

  return {
    token,
    session: {
      walletAddress,
      profile: null,
      expiresAt: result.expires_at,
      authProvider: provider,
    },
  };
}

export function setExternalSessionCookie(
  response: NextResponse,
  established: Awaited<ReturnType<typeof establishExternalSession>>,
) {
  response.cookies.set(
    SESSION_COOKIE,
    established.token,
    sessionCookieOptions(new Date(established.session.expiresAt)),
  );
}

export function assertServerExternalAuthConfiguration() {
  getSupabaseServiceRoleKey();
  getExternalAuthSecret();
  getExternalAuthOrigin();
}
