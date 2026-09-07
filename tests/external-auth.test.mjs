import assert from "node:assert/strict";
import { createHash, createHmac, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import bs58 from "bs58";
import {
  createExternalAuthState,
  deriveExternalIdentityKey,
  normalizeReturnTo,
  openExternalAuthTransaction,
  sealExternalAuthTransaction,
  verifyTelegramLogin,
  verifyTelegramOidcIdToken,
} from "../src/lib/auth/external-core.ts";

const SECRET = "test-only-external-auth-secret-with-more-than-thirty-two-bytes";

test("external identity keys are deterministic, private, and valid 32-byte base58 profile IDs", () => {
  const first = deriveExternalIdentityKey("google", "provider-subject-123", SECRET);
  const repeated = deriveExternalIdentityKey("google", "provider-subject-123", SECRET);
  const otherProvider = deriveExternalIdentityKey("apple", "provider-subject-123", SECRET);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, otherProvider);
  assert.equal(bs58.decode(first.proxyWalletAddress).length, 32);
  assert.match(first.subjectHash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(first).includes("provider-subject-123"), false);
});

test("external authentication transactions are authenticated and hide their contents", () => {
  const transaction = {
    version: 1,
    provider: "google",
    state: "A".repeat(43),
    createdAt: 1_787_330_000_000,
    returnTo: "/p/96?from=login",
    authStorage: { "sb-test-code-verifier": "private-pkce-verifier" },
  };
  const sealed = sealExternalAuthTransaction(transaction, SECRET);

  assert.deepEqual(openExternalAuthTransaction(sealed, SECRET), transaction);
  assert.equal(sealed.includes(transaction.state), false);
  assert.equal(sealed.includes("private-pkce-verifier"), false);

  const parts = sealed.split(".");
  const replacement = parts[2][5] === "A" ? "B" : "A";
  parts[2] = `${parts[2].slice(0, 5)}${replacement}${parts[2].slice(6)}`;
  assert.equal(openExternalAuthTransaction(parts.join("."), SECRET), null);
  assert.equal(openExternalAuthTransaction(sealed, `${SECRET}-wrong`), null);
});

test("return paths cannot escape the Money Nerds origin or loop through auth routes", () => {
  assert.equal(normalizeReturnTo("/u/profile?page=2#posts"), "/u/profile?page=2#posts");
  assert.equal(normalizeReturnTo("https://attacker.example/"), "/");
  assert.equal(normalizeReturnTo("//attacker.example/"), "/");
  assert.equal(normalizeReturnTo("/\\attacker.example/"), "/");
  assert.equal(normalizeReturnTo("/api/auth/session"), "/");
});

test("generated state is URL-safe and has enough entropy", () => {
  const first = createExternalAuthState();
  const second = createExternalAuthState();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("Telegram verification accepts only a fresh, correctly signed payload", () => {
  const botToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN";
  const now = 1_787_330_000;
  const unsigned = {
    id: "987654321",
    first_name: "Money",
    username: "money_nerd",
    auth_date: String(now - 20),
  };
  const dataCheckString = Object.entries(unsigned)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const telegramSecret = createHash("sha256").update(botToken).digest();
  const hash = createHmac("sha256", telegramSecret).update(dataCheckString).digest("hex");
  const payload = { ...unsigned, hash };

  assert.deepEqual(verifyTelegramLogin(payload, botToken, now), {
    ok: true,
    subject: unsigned.id,
  });
  assert.deepEqual(verifyTelegramLogin({ ...payload, username: "tampered" }, botToken, now), {
    ok: false,
    code: "invalid_signature",
  });
  assert.deepEqual(verifyTelegramLogin(payload, botToken, now + 600), {
    ok: false,
    code: "expired",
  });
});

test("Telegram OIDC verification checks signature, claims, and legacy identity continuity", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2_048 });
  const clientId = "987654321";
  const nonce = "N".repeat(43);
  const now = 1_787_330_000;
  const jwk = publicKey.export({ format: "jwk" });
  const jwks = { keys: [{ ...jwk, alg: "RS256", kid: "telegram-test-key", use: "sig" }] };
  const createToken = (overrides = {}, headerOverrides = {}) => {
    const header = Buffer.from(
      JSON.stringify({
        alg: "RS256",
        kid: "telegram-test-key",
        typ: "JWT",
        ...headerOverrides,
      }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: "https://oauth.telegram.org",
        aud: clientId,
        sub: "telegram-oidc-subject",
        id: 987654321,
        iat: now - 10,
        exp: now + 300,
        nonce,
        given_name: "Money",
        family_name: "Nerd",
        preferred_username: "money_nerd",
        ...overrides,
      }),
    ).toString("base64url");
    const signingInput = `${header}.${payload}`;
    return `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url")}`;
  };

  const validToken = createToken();
  assert.deepEqual(
    verifyTelegramOidcIdToken(validToken, jwks, { clientId, nonce, nowSeconds: now }),
    {
      ok: true,
      identity: {
        telegramUserId: "987654321",
        oidcSubject: "telegram-oidc-subject",
        firstName: "Money",
        lastName: "Nerd",
        username: "money_nerd",
      },
    },
  );
  const tokenParts = validToken.split(".");
  tokenParts[2] = `${tokenParts[2][0] === "A" ? "B" : "A"}${tokenParts[2].slice(1)}`;
  assert.deepEqual(
    verifyTelegramOidcIdToken(tokenParts.join("."), jwks, { clientId, nonce, nowSeconds: now }),
    { ok: false, code: "invalid_signature" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ aud: "111111111" }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ iss: "https://attacker.example" }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ nonce: "X".repeat(43) }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ exp: now - 31 }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "expired" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ iat: now + 31 }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "expired" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ nbf: now + 31 }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "expired" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ sub: "" }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ id: "not-a-telegram-id" }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(createToken({ aud: [clientId, "another-audience"] }), jwks, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
  assert.equal(
    verifyTelegramOidcIdToken(
      createToken({ aud: [clientId, "another-audience"], azp: clientId }),
      jwks,
      { clientId, nonce, nowSeconds: now },
    ).ok,
    true,
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(
      createToken({}, { kid: "future-telegram-key" }),
      jwks,
      { clientId, nonce, nowSeconds: now },
    ),
    { ok: false, code: "unknown_key" },
  );
  assert.deepEqual(
    verifyTelegramOidcIdToken(validToken, { keys: [jwks.keys[0], jwks.keys[0]] }, {
      clientId,
      nonce,
      nowSeconds: now,
    }),
    { ok: false, code: "invalid_token" },
  );
});
