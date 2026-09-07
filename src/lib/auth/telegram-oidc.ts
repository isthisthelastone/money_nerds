import "server-only";

import { getTelegramOidcConfiguration } from "@/lib/auth/external";
import {
  verifyTelegramOidcIdToken,
  type TelegramOidcIdentity,
} from "@/lib/auth/external-core";

const TELEGRAM_TOKEN_ENDPOINT = "https://oauth.telegram.org/token";
const TELEGRAM_JWKS_ENDPOINT = "https://oauth.telegram.org/.well-known/jwks.json";
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
