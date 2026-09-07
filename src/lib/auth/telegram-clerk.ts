import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { getExternalAuthOrigin } from "@/lib/auth/external";
import { normalizeReturnTo } from "@/lib/auth/external-core";

export interface VerifiedTelegramIdentity {
  subject: string;
  firstName?: string;
  lastName?: string;
}

function telegramName(value: string | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, 256) : undefined;
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
