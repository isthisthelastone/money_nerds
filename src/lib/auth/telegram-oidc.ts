import "server-only";

import { createHash } from "node:crypto";
import { getTelegramOidcConfiguration } from "@/lib/auth/external";
import { isTelegramNativeAuthorizationUrl } from "@/lib/auth/telegram-links";
import {
  verifyTelegramOidcIdToken,
  type TelegramOidcIdentity,
} from "@/lib/auth/external-core";

const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
const TELEGRAM_JWKS_ENDPOINT = "https://oauth.telegram.org/.well-known/jwks.json";
const TELEGRAM_CROSS_APP_ENDPOINT = "https://oauth.telegram.org/crossapp";
const MAXIMUM_TELEGRAM_RESPONSE_BYTES = 64 * 1_024;

let cachedJwks: { value: unknown; loadedAt: number; expiresAt: number } | null = null;

async function readBoundedResponse(response: Response) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    if (Number(declaredLength) > MAXIMUM_TELEGRAM_RESPONSE_BYTES) {
      throw new Error("Telegram response is too large.");
    }
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Telegram returned an empty response.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAXIMUM_TELEGRAM_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Telegram response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readJsonResponse(response: Response) {
  const text = await readBoundedResponse(response);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Telegram returned invalid JSON.");
  }
}

export function createTelegramOidcAuthorizationUrl(state: string, codeVerifier: string, nonce: string) {
  const configuration = getTelegramOidcConfiguration();
  const url = new URL("https://oauth.telegram.org/auth");
  url.search = new URLSearchParams({
    client_id: configuration.clientId,
    redirect_uri: configuration.redirectUri,
    response_type: "code",
    scope: "openid profile",
    state,
    nonce,
    code_challenge: createHash("sha256").update(codeVerifier, "ascii").digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url;
}

export async function requestTelegramNativeAuthorizationUrl(
  authorizationUrl: URL,
  userAgent: string | null,
): Promise<string | null> {
  // Telegram's first-party native SDK uses /crossapp to issue a token whose
  // approval returns to redirect_uri. It also currently accepts registered web
  // callbacks, without pretending this website has an iOS/Android app ID.
  // This endpoint is not part of the web OIDC discovery contract: any failure
  // must fall back to the documented /auth flow, never block sign-in.
  const url = new URL(TELEGRAM_CROSS_APP_ENDPOINT);
  url.search = authorizationUrl.search;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(userAgent && userAgent.length <= 1_024 && !/[\r\n]/.test(userAgent)
          ? { "User-Agent": userAgent }
          : {}),
      },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return null;
    const body = await readJsonResponse(response);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    const nativeUrl = (body as Record<string, unknown>).url;
    // Preserve the provider-issued URL verbatim, including any future return
    // parameters. Constructing tg:// URLs from authorization params is invalid.
    return isTelegramNativeAuthorizationUrl(nativeUrl) ? nativeUrl : null;
  } catch {
    return null;
  }
}

async function getTelegramJwks(forceRefresh = false) {
  const now = Date.now();
  if (
    cachedJwks &&
    cachedJwks.expiresAt > now &&
    (!forceRefresh || cachedJwks.loadedAt > now - 30_000)
  ) {
    return cachedJwks.value;
  }
  const response = await fetch(TELEGRAM_JWKS_ENDPOINT, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Telegram verification keys are unavailable.");
  const value = await readJsonResponse(response);
  const loadedAt = Date.now();
  cachedJwks = { value, loadedAt, expiresAt: loadedAt + 60 * 60 * 1_000 };
  return value;
}

export type TelegramOidcExchangeResult =
  | { ok: true; identity: TelegramOidcIdentity }
  | { ok: false; code: "invalid_callback" | "temporarily_unavailable" };

export async function exchangeTelegramOidcCode(
  code: string,
  codeVerifier: string,
  nonce: string,
): Promise<TelegramOidcExchangeResult> {
  if (
    code.length < 1 ||
    code.length > 4_096 ||
    /[\u0000-\u001f\u007f]/.test(code) ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeVerifier) ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce)
  ) {
    return { ok: false, code: "invalid_callback" };
  }

  const configuration = getTelegramOidcConfiguration();
  let response: Response;
  try {
    response = await fetch(TELEGRAM_TOKEN_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${configuration.clientId}:${configuration.clientSecret}`,
          "utf8",
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: configuration.redirectUri,
        client_id: configuration.clientId,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, code: "temporarily_unavailable" };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: response.status >= 500 ? "temporarily_unavailable" : "invalid_callback",
    };
  }

  let tokenResponse: unknown;
  try {
    tokenResponse = await readJsonResponse(response);
  } catch {
    return { ok: false, code: "temporarily_unavailable" };
  }
  if (!tokenResponse || typeof tokenResponse !== "object" || Array.isArray(tokenResponse)) {
    return { ok: false, code: "invalid_callback" };
  }
  const idToken = (tokenResponse as Record<string, unknown>).id_token;
  if (typeof idToken !== "string") return { ok: false, code: "invalid_callback" };

  let jwks: unknown;
  try {
    jwks = await getTelegramJwks();
  } catch {
    return { ok: false, code: "temporarily_unavailable" };
  }
  let verified = verifyTelegramOidcIdToken(idToken, jwks, {
    clientId: configuration.clientId,
    nonce,
  });
  if (!verified.ok && (verified.code === "unknown_key" || verified.code === "invalid_signature")) {
    try {
      jwks = await getTelegramJwks(true);
    } catch {
      return { ok: false, code: "temporarily_unavailable" };
    }
    verified = verifyTelegramOidcIdToken(idToken, jwks, {
      clientId: configuration.clientId,
      nonce,
    });
  }
  if (!verified.ok) return { ok: false, code: "invalid_callback" };
  return { ok: true, identity: verified.identity };
}
