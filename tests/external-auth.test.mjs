import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import bs58 from "bs58";
import {
  createExternalAuthState,
  deriveExternalIdentityKey,
  normalizeReturnTo,
  openExternalAuthTransaction,
  sealExternalAuthTransaction,
  verifyTelegramLogin,
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
