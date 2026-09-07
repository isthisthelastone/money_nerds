import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  type JsonWebKey as NodeJsonWebKey,
  verify as verifySignature,
} from "node:crypto";
import bs58 from "bs58";

export const EXTERNAL_AUTH_PROVIDERS = ["google", "apple", "telegram"] as const;
export type ExternalAuthProvider = (typeof EXTERNAL_AUTH_PROVIDERS)[number];
export type OAuthProvider = Exclude<ExternalAuthProvider, "telegram">;

const TRANSACTION_VERSION = "v1";
const TRANSACTION_AAD = Buffer.from("money-nerds:external-auth-transaction:v1", "utf8");
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/;
const TELEGRAM_HASH_PATTERN = /^[0-9a-f]{64}$/i;
const TELEGRAM_ID_PATTERN = /^[1-9][0-9]{0,19}$/;
const TELEGRAM_OPTIONAL_FIELDS = ["first_name", "last_name", "username", "photo_url"] as const;

export interface ExternalIdentityKey {
  proxyWalletAddress: string;
  subjectHash: string;
}

export interface ExternalAuthTransaction {
  version: 1;
  provider: ExternalAuthProvider;
  state: string;
  createdAt: number;
  returnTo: string;
  authStorage: Record<string, string>;
}

export interface TelegramLoginPayload {
  id: string;
  auth_date: string;
  hash: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export type TelegramVerificationResult =
  | { ok: true; subject: string }
  | { ok: false; code: "invalid_payload" | "invalid_signature" | "expired" };

export interface TelegramOidcIdentity {
  /** Telegram's signed profile `id`, used to preserve legacy-widget accounts. */
  telegramUserId: string;
  /** Telegram's canonical OIDC `sub`, retained separately from the profile ID. */
  oidcSubject: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}

export type TelegramOidcVerificationResult =
  | { ok: true; identity: TelegramOidcIdentity }
  | { ok: false; code: "invalid_token" | "unknown_key" | "invalid_signature" | "expired" };

function requireStrongSecret(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("EXTERNAL_AUTH_SECRET must contain at least 32 bytes.");
  }
}

function deriveContextKey(secret: string, context: string) {
  requireStrongSecret(secret);
  return createHmac("sha256", secret)
    .update(`money-nerds:${context}:v1`, "utf8")
    .digest();
}

export function isExternalAuthProvider(value: unknown): value is ExternalAuthProvider {
  return typeof value === "string" && EXTERNAL_AUTH_PROVIDERS.includes(value as ExternalAuthProvider);
}

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === "google" || value === "apple";
}

export function createExternalAuthState() {
  return randomBytes(32).toString("base64url");
}

export function normalizeReturnTo(value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return "/";
  }

  try {
    const parsed = new URL(value, "https://money-nerds.invalid");
    if (parsed.origin !== "https://money-nerds.invalid" || parsed.pathname.startsWith("/api/auth/")) return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function deriveExternalIdentityKey(
  provider: ExternalAuthProvider,
  subject: string,
  secret: string,
): ExternalIdentityKey {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject || normalizedSubject.length > 512 || /[\u0000-\u001f]/.test(normalizedSubject)) {
    throw new Error("External identity subject is invalid.");
  }

  const scopedSubject = `${provider}\u0000${normalizedSubject}`;
  const subjectHash = createHmac("sha256", deriveContextKey(secret, "external-subject"))
    .update(scopedSubject, "utf8")
    .digest("hex");
  const proxyWalletAddress = bs58.encode(
    createHmac("sha256", deriveContextKey(secret, "external-profile"))
      .update(scopedSubject, "utf8")
      .digest(),
  );

  return { proxyWalletAddress, subjectHash };
}

function isAuthStorage(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 16 &&
    entries.every(
      ([key, entry]) =>
        key.length >= 1 && key.length <= 256 && typeof entry === "string" && entry.length <= 3_000,
    )
  );
}

function parseExternalAuthTransaction(value: unknown): ExternalAuthTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const transaction = value as Partial<ExternalAuthTransaction>;
  if (
    transaction.version !== 1 ||
    !isExternalAuthProvider(transaction.provider) ||
    typeof transaction.state !== "string" ||
    !STATE_PATTERN.test(transaction.state) ||
    typeof transaction.createdAt !== "number" ||
    !Number.isSafeInteger(transaction.createdAt) ||
    transaction.returnTo !== normalizeReturnTo(transaction.returnTo) ||
    !isAuthStorage(transaction.authStorage)
  ) {
    return null;
  }
  return transaction as ExternalAuthTransaction;
}

export function sealExternalAuthTransaction(transaction: ExternalAuthTransaction, secret: string) {
  const checked = parseExternalAuthTransaction(transaction);
  if (!checked) throw new Error("External authentication transaction is invalid.");

  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveContextKey(secret, "external-cookie"), initializationVector);
  cipher.setAAD(TRANSACTION_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(checked), "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();
  return [
    TRANSACTION_VERSION,
    initializationVector.toString("base64url"),
    ciphertext.toString("base64url"),
    authenticationTag.toString("base64url"),
  ].join(".");
}

export function openExternalAuthTransaction(value: string, secret: string) {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = value.split(".");
  if (version !== TRANSACTION_VERSION || !encodedIv || !encodedCiphertext || !encodedTag || extra) return null;

  try {
    const initializationVector = Buffer.from(encodedIv, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext, "base64url");
    const authenticationTag = Buffer.from(encodedTag, "base64url");
    if (initializationVector.length !== 12 || authenticationTag.length !== 16 || ciphertext.length > 8_192) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveContextKey(secret, "external-cookie"),
      initializationVector,
    );
    decipher.setAAD(TRANSACTION_AAD);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return parseExternalAuthTransaction(JSON.parse(plaintext));
  } catch {
    return null;
  }
}

export function constantTimeStringEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function parseTelegramLoginPayload(value: unknown): TelegramLoginPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "number" ? String(record.id) : record.id;
  const authDate = typeof record.auth_date === "number" ? String(record.auth_date) : record.auth_date;
  if (
    typeof id !== "string" ||
    !TELEGRAM_ID_PATTERN.test(id) ||
    typeof authDate !== "string" ||
    !/^[0-9]{1,12}$/.test(authDate) ||
    typeof record.hash !== "string" ||
    !TELEGRAM_HASH_PATTERN.test(record.hash)
  ) {
    return null;
  }

  const payload: TelegramLoginPayload = { id, auth_date: authDate, hash: record.hash.toLowerCase() };
  for (const field of TELEGRAM_OPTIONAL_FIELDS) {
    const item = record[field];
    if (item === undefined) continue;
    if (typeof item !== "string" || item.length > (field === "photo_url" ? 2_048 : 256)) return null;
    payload[field] = item;
  }
  return payload;
}

export function telegramDataCheckString(payload: TelegramLoginPayload) {
  return Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function verifyTelegramLogin(
  value: unknown,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
  maximumAgeSeconds = 5 * 60,
): TelegramVerificationResult {
  const payload = parseTelegramLoginPayload(value);
  if (!payload || !botToken || maximumAgeSeconds < 1) return { ok: false, code: "invalid_payload" };

  const telegramSecret = createHash("sha256").update(botToken, "utf8").digest();
  const expectedHash = createHmac("sha256", telegramSecret)
    .update(telegramDataCheckString(payload), "utf8")
    .digest("hex");
  if (!constantTimeStringEqual(expectedHash, payload.hash)) return { ok: false, code: "invalid_signature" };

  const authenticatedAt = Number(payload.auth_date);
  if (
    !Number.isSafeInteger(authenticatedAt) ||
    authenticatedAt > nowSeconds + 30 ||
    authenticatedAt < nowSeconds - maximumAgeSeconds
  ) {
    return { ok: false, code: "expired" };
  }
  return { ok: true, subject: payload.id };
}

function decodeJwtJson(segment: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment) || segment.length > 16_384) return null;
  try {
    const value = JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function oidcAudienceMatches(value: unknown, authorizedParty: unknown, clientId: string) {
  if (typeof value === "string") {
    return (
      constantTimeStringEqual(value, clientId) &&
      (authorizedParty === undefined ||
        (typeof authorizedParty === "string" &&
          constantTimeStringEqual(authorizedParty, clientId)))
    );
  }
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 8 ||
    !value.every((entry) => typeof entry === "string") ||
    !value.some((entry) => constantTimeStringEqual(entry, clientId))
  ) {
    return false;
  }
  return value.length === 1
    ? authorizedParty === undefined ||
        (typeof authorizedParty === "string" && constantTimeStringEqual(authorizedParty, clientId))
    : typeof authorizedParty === "string" && constantTimeStringEqual(authorizedParty, clientId);
}

function oidcTelegramId(value: unknown) {
  const normalized = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  return typeof normalized === "string" && TELEGRAM_ID_PATTERN.test(normalized) ? normalized : null;
}

function oidcSubject(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 255 &&
    !/[\u0000-\u001f\u007f]/.test(value)
    ? value
    : null;
}

function oidcOptionalText(value: unknown, maximumLength: number) {
  if (value === undefined) return undefined;
  return typeof value === "string" && value.length <= maximumLength ? value : null;
}

export function verifyTelegramOidcIdToken(
  value: unknown,
  jwks: unknown,
  expected: { clientId: string; nonce: string; nowSeconds?: number },
): TelegramOidcVerificationResult {
  if (
    typeof value !== "string" ||
    value.length < 32 ||
    value.length > 16_384 ||
    !/^[1-9][0-9]{0,19}$/.test(expected.clientId) ||
    !STATE_PATTERN.test(expected.nonce)
  ) {
    return { ok: false, code: "invalid_token" };
  }

  const [encodedHeader, encodedPayload, encodedSignature, extra] = value.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra) {
    return { ok: false, code: "invalid_token" };
  }
  const header = decodeJwtJson(encodedHeader);
  const payload = decodeJwtJson(encodedPayload);
  if (
    !header ||
    !payload ||
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.kid.length < 1 ||
    header.kid.length > 128 ||
    (header.typ !== undefined && header.typ !== "JWT") ||
    header.crit !== undefined
  ) {
    return { ok: false, code: "invalid_token" };
  }

  const keySet =
    jwks && typeof jwks === "object" && !Array.isArray(jwks)
      ? (jwks as { keys?: unknown }).keys
      : null;
  if (!Array.isArray(keySet) || keySet.length < 1 || keySet.length > 16) {
    return { ok: false, code: "invalid_token" };
  }
  const matchingKeys = keySet.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          (entry as Record<string, unknown>).kid === header.kid &&
          (entry as Record<string, unknown>).kty === "RSA" &&
          (entry as Record<string, unknown>).alg === "RS256" &&
          typeof (entry as Record<string, unknown>).n === "string" &&
          typeof (entry as Record<string, unknown>).e === "string",
      ),
  );
  if (matchingKeys.length === 0) return { ok: false, code: "unknown_key" };
  if (matchingKeys.length !== 1) return { ok: false, code: "invalid_token" };
  const key = matchingKeys[0];
  if (
    (key.use !== undefined && key.use !== "sig") ||
    (key.key_ops !== undefined &&
      (!Array.isArray(key.key_ops) || !key.key_ops.includes("verify")))
  ) {
    return { ok: false, code: "invalid_token" };
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(encodedSignature, "base64url");
    const publicKey = createPublicKey({ key: key as NodeJsonWebKey, format: "jwk" });
    if (
      signature.length < 64 ||
      !verifySignature(
        "RSA-SHA256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`, "ascii"),
        publicKey,
        signature,
      )
    ) {
      return { ok: false, code: "invalid_signature" };
    }
  } catch {
    return { ok: false, code: "invalid_signature" };
  }

  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (
    payload.iss !== "https://oauth.telegram.org" ||
    !oidcAudienceMatches(payload.aud, payload.azp, expected.clientId) ||
    typeof payload.exp !== "number" ||
    !Number.isSafeInteger(payload.exp) ||
    typeof payload.iat !== "number" ||
    !Number.isSafeInteger(payload.iat) ||
    typeof payload.nonce !== "string" ||
    !constantTimeStringEqual(payload.nonce, expected.nonce)
  ) {
    return { ok: false, code: "invalid_token" };
  }
  if (
    payload.exp <= now - 30 ||
    payload.iat > now + 30 ||
    (payload.nbf !== undefined &&
      (typeof payload.nbf !== "number" || !Number.isSafeInteger(payload.nbf) || payload.nbf > now + 30))
  ) {
    return { ok: false, code: "expired" };
  }

  const telegramUserId = oidcTelegramId(payload.id);
  const canonicalSubject = oidcSubject(payload.sub);
  if (!telegramUserId || !canonicalSubject) return { ok: false, code: "invalid_token" };
  const firstName = oidcOptionalText(payload.given_name, 256);
  const lastName = oidcOptionalText(payload.family_name, 256);
  const username = oidcOptionalText(payload.preferred_username, 256);
  if (firstName === null || lastName === null || username === null) {
    return { ok: false, code: "invalid_token" };
  }
  return {
    ok: true,
    identity: {
      telegramUserId,
      oidcSubject: canonicalSubject,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(username ? { username } : {}),
    },
  };
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && HEX_SHA256_PATTERN.test(value);
}
