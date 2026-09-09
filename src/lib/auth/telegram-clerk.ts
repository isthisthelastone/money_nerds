import "server-only";

import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { getExternalAuthOrigin } from "@/lib/auth/external";
import { normalizeReturnTo } from "@/lib/auth/external-core";
import { syncVerifiedTelegramClerkProfile } from "@/lib/auth/server";

export interface VerifiedTelegramIdentity {
  subject: string;
  firstName?: string;
  lastName?: string;
}

function telegramName(value: string | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, 256) : undefined;
}

function newTelegramUsername() {
  // A Clerk ticket needs an identification, not just externalId. This opaque
  // identifier is never a password or an account-linking key. Telegram handles
  // can change or be reassigned, so do not use them for this purpose.
  return `mn_tg_${randomBytes(18).toString("hex")}`;
}

export async function createTelegramClerkSignIn(
  identity: VerifiedTelegramIdentity,
  returnTo: string,
) {
  if (!/^[1-9][0-9]{0,19}$/.test(identity.subject)) {
    throw new Error("Telegram identity is invalid.");
  }

  const client = await clerkClient();
  const externalId = `telegram:${identity.subject}`;
  let users = await client.users.getUserList({ externalId: [externalId], limit: 2 });
  if (users.totalCount > 1) throw new Error("Telegram identity is not unique.");

  let user = users.data.at(0);
  if (!user) {
    try {
      user = await client.users.createUser({
        externalId,
        username: newTelegramUsername(),
        firstName: telegramName(identity.firstName),
        lastName: telegramName(identity.lastName),
        skipPasswordRequirement: true,
      });
    } catch {
      // A concurrent callback may have created the same immutable Telegram
      // identity. Re-read by unique externalId and continue only if it exists.
      users = await client.users.getUserList({ externalId: [externalId], limit: 2 });
      user = users.totalCount === 1 ? users.data.at(0) : undefined;
    }
  }
  if (!user) throw new Error("Telegram identity could not be created.");
  if (user.externalId !== externalId || user.banned || user.locked) {
    throw new Error("Telegram account is unavailable.");
  }

  if (!user.username) {
    // Repair accounts created by the previous identifier-less implementation
    // in place. Never create a replacement or claim a matching username.
    user = await client.users.updateUser(user.id, {
      username: newTelegramUsername(),
    });
  }
  if (!user.username || user.externalId !== externalId) {
    throw new Error("Telegram sign-in identification could not be established.");
  }

  // Telegram has already authenticated this identity. Establish its durable
  // profile before issuing the ticket, rather than relying on a later render
  // or asynchronous webhook to create the first database mapping.
  await syncVerifiedTelegramClerkProfile(user, identity.subject);

  const ticket = await client.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  });
  const signInUrl = new URL(ticket.url);
  if (signInUrl.protocol !== "https:" || signInUrl.username || signInUrl.password) {
    throw new Error("Clerk returned an invalid sign-in URL.");
  }
  signInUrl.searchParams.set(
    "redirect_url",
    new URL(normalizeReturnTo(returnTo), getExternalAuthOrigin()).href,
  );
  return signInUrl.href;
}
