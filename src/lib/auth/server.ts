import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { clerkClient, auth } from "@clerk/nextjs/server";
import bs58 from "bs58";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/config";
import { deriveExternalIdentityKey } from "@/lib/auth/external-core";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type {
  AuthProvider,
  WalletProfile,
  WalletSession,
} from "@/lib/models";

const PROFILE_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface ClerkUserSnapshot {
  id: string;
  createdAt: number;
  updatedAt: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string;
  externalId: string | null;
  web3Wallets: Array<{
    id: string;
    web3Wallet: string;
    verification: { status: string } | null;
  }>;
  externalAccounts: Array<{
    provider: string;
    providerUserId: string;
    verification: { status: string } | null;
  }>;
}

interface ClerkProfileLinkResult {
  profileWallet: string;
  deleted: boolean;
}

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const createOpaqueSessionToken = () => randomBytes(32).toString("base64url");

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

function profileIdentitySecret() {
  const secret =
    process.env.PROFILE_IDENTITY_SECRET?.trim() ||
    process.env.EXTERNAL_AUTH_SECRET?.trim() ||
    "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("PROFILE_IDENTITY_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

function legacyExternalIdentitySecret() {
  const secret = process.env.EXTERNAL_AUTH_SECRET?.trim() ?? "";
  return Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

/** Stable, pseudonymous public key. Raw Clerk identifiers remain private. */
export function deriveClerkProfileWallet(clerkUserId: string) {
  const digest = createHmac("sha256", profileIdentitySecret())
    .update("money-nerds:clerk-profile:v1\0", "utf8")
    .update(clerkUserId, "utf8")
    .digest();
  const profileWallet = bs58.encode(digest);
  if (!PROFILE_KEY_PATTERN.test(profileWallet) || profileWallet === "11111111111111111111111111111111") {
    throw new Error("Unable to derive a valid Clerk profile key.");
  }
  return profileWallet;
}

function clerkDisplayName(user: ClerkUserSnapshot) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return (fullName || user.username || "Money Nerd").slice(0, 80);
}

function normalizeExternalProvider(provider: string): "google" | "apple" | null {
  const normalized = provider.toLowerCase().replace(/^oauth_/, "");
  return normalized === "google" || normalized === "apple" ? normalized : null;
}

function authProviderForUser(user: ClerkUserSnapshot): AuthProvider {
  if (user.externalId?.startsWith("telegram:")) return "telegram";
  for (const account of user.externalAccounts) {
    if (account.verification?.status !== "verified") continue;
    const provider = normalizeExternalProvider(account.provider);
    if (provider) return provider;
  }
  if (user.web3Wallets.some((wallet) => wallet.verification?.status === "verified")) {
    return "wallet";
  }
  return "clerk";
}

function authProviderForProfile(profile: WalletProfile): AuthProvider {
  if (profile.identity_kind === "wallet") return "wallet";
  return profile.identity_provider ?? "clerk";
}

function parseClerkProfileLink(value: unknown): ClerkProfileLinkResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.profile_wallet !== "string" ||
    !PROFILE_KEY_PATTERN.test(record.profile_wallet) ||
    typeof record.deleted !== "boolean"
  ) {
    return null;
  }
  return { profileWallet: record.profile_wallet, deleted: record.deleted };
}

async function getClerkProfileLink(clerkUserId: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("get_clerk_profile", {
    p_clerk_user_id: clerkUserId,
  });
  if (error) {
    console.error("Unable to read Clerk profile mapping", { code: error.code });
    throw new Error("CLERK_PROFILE_LOOKUP_FAILED");
  }
  return parseClerkProfileLink(data);
}

async function loadProfile(profileWallet: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "wallet_address, identity_kind, identity_provider, display_name, bio, avatar_url, created_at, updated_at",
    )
    .eq("wallet_address", profileWallet)
    .maybeSingle();
  if (error) {
    console.error("Unable to load canonical profile", { code: error.code });
    throw new Error("PROFILE_LOOKUP_FAILED");
  }
  return (data as WalletProfile | null) ?? null;
}

async function legacySessionCandidate() {
  const token = await getSessionToken();
  if (!token) return null;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("get_wallet_session", {
    p_token_hash: hashSessionToken(token),
  });
  const record = data as { wallet_address?: unknown } | null;
  if (error || typeof record?.wallet_address !== "string") return null;
  return PROFILE_KEY_PATTERN.test(record.wallet_address)
    ? { profileWallet: record.wallet_address, tokenHash: hashSessionToken(token) }
    : null;
}

async function existingVerifiedSolanaCandidate(user: ClerkUserSnapshot) {
  const addresses = Array.from(
    new Set(
      user.web3Wallets
        .filter((wallet) => wallet.verification?.status === "verified")
        .map((wallet) => wallet.web3Wallet.trim())
        .filter((address) => PROFILE_KEY_PATTERN.test(address)),
    ),
  );
  if (addresses.length === 0) return null;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("wallet_address")
    .in("wallet_address", addresses);
  if (error) throw new Error("PROFILE_LOOKUP_FAILED");
  const matches = Array.from(
    new Set(
      (data ?? [])
        .map((profile) => profile.wallet_address)
        .filter((address): address is string => typeof address === "string"),
    ),
  );
  if (matches.length > 1) throw new Error("AMBIGUOUS_VERIFIED_WALLET_PROFILES");
  return matches[0] ?? null;
}

async function existingExternalIdentityCandidate(user: ClerkUserSnapshot) {
  const identities: Array<{ provider: "google" | "apple" | "telegram"; subject: string }> = [];
  if (user.externalId?.startsWith("telegram:")) {
    const subject = user.externalId.slice("telegram:".length);
    if (/^[1-9][0-9]{0,19}$/.test(subject)) identities.push({ provider: "telegram", subject });
  }
  for (const account of user.externalAccounts) {
    if (account.verification?.status !== "verified" || !account.providerUserId) continue;
    const provider = normalizeExternalProvider(account.provider);
    if (provider) identities.push({ provider, subject: account.providerUserId });
  }
  if (identities.length === 0) return null;

  const secret = legacyExternalIdentitySecret();
  if (!secret) return null;
  const candidates = Array.from(
    new Map(
      identities.map(({ provider, subject }) => {
        const derived = deriveExternalIdentityKey(provider, subject, secret);
        return [
          `${provider}:${derived.subjectHash}`,
          {
            provider,
            subjectHash: derived.subjectHash,
            profileWallet: derived.proxyWalletAddress,
          },
        ];
      }),
    ).values(),
  );
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("wallet_address")
    .in("wallet_address", candidates.map((candidate) => candidate.profileWallet));
  if (error) throw new Error("PROFILE_LOOKUP_FAILED");
  const existingWallets = new Set(
    (data ?? [])
      .map((profile) => profile.wallet_address)
      .filter((address): address is string => typeof address === "string"),
  );
  const matches = candidates.filter((candidate) => existingWallets.has(candidate.profileWallet));
  if (matches.length > 1) throw new Error("AMBIGUOUS_EXTERNAL_PROFILES");
  return matches[0] ?? null;
}

async function syncNewClerkProfile(user: ClerkUserSnapshot) {
  const profileWallet = deriveClerkProfileWallet(user.id);
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("sync_clerk_profile", {
    p_clerk_user_id: user.id,
    p_proxy_wallet_address: profileWallet,
    p_clerk_updated_at: new Date(user.updatedAt).toISOString(),
    p_display_name: clerkDisplayName(user),
    p_avatar_url: user.imageUrl.startsWith("https://") ? user.imageUrl : null,
    p_clerk_created_at: new Date(user.createdAt).toISOString(),
    p_deleted: false,
  });
  const result = parseClerkProfileLink(data);
  if (error || !result || result.deleted) {
    if (error) console.error("Unable to sync Clerk profile", { code: error.code });
    throw new Error("CLERK_PROFILE_SYNC_FAILED");
  }
  return result.profileWallet;
}

export interface ClerkWebhookUserSnapshot {
  id: string;
  createdAt: number | null;
  updatedAt: number;
  displayName: string | null;
  avatarUrl: string | null;
  deleted: boolean;
}

/**
 * Webhooks update an established mapping but never win first-profile binding.
 * The signed-in request creates the link synchronously, preserving a valid
 * legacy-session or verified-wallet claim before eventual webhook delivery.
 */
export async function syncExistingClerkProfileFromWebhook(
  event: ClerkWebhookUserSnapshot,
) {
  const existing = await getClerkProfileLink(event.id);
  if (!existing) return false;

  const supabase = createAdminSupabase();
  const { error } = await supabase.rpc("sync_clerk_profile", {
    p_clerk_user_id: event.id,
    p_proxy_wallet_address: existing.profileWallet,
    p_clerk_updated_at: new Date(event.updatedAt).toISOString(),
    p_display_name: event.deleted ? null : event.displayName,
    p_avatar_url:
      !event.deleted && event.avatarUrl?.startsWith("https://") ? event.avatarUrl : null,
    p_clerk_created_at:
      event.createdAt === null ? null : new Date(event.createdAt).toISOString(),
    p_deleted: event.deleted,
  });
  if (error) {
    console.error("Unable to apply Clerk user webhook", { code: error.code });
    throw new Error("CLERK_WEBHOOK_SYNC_FAILED");
  }
  return true;
}

function clerkBindingMetadata(user: ClerkUserSnapshot) {
  return {
    p_clerk_user_id: user.id,
    p_clerk_updated_at: new Date(user.updatedAt).toISOString(),
    p_display_name: clerkDisplayName(user),
    p_avatar_url: user.imageUrl.startsWith("https://") ? user.imageUrl : null,
    p_clerk_created_at: new Date(user.createdAt).toISOString(),
  };
}

async function bindLegacyClerkProfile(user: ClerkUserSnapshot, legacyTokenHash: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("bind_clerk_profile_from_legacy_session", {
    ...clerkBindingMetadata(user),
    p_legacy_token_hash: legacyTokenHash,
  });
  const result = parseClerkProfileLink(data);
  if (error || !result || result.deleted) {
    if (error) console.error("Unable to bind legacy profile to Clerk", { code: error.code });
    throw new Error("CLERK_PROFILE_BIND_FAILED");
  }
  return result.profileWallet;
}

async function bindVerifiedWalletClerkProfile(user: ClerkUserSnapshot, profileWallet: string) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("bind_clerk_profile_from_verified_wallet", {
    ...clerkBindingMetadata(user),
    p_profile_wallet: profileWallet,
  });
  const result = parseClerkProfileLink(data);
  if (error || !result || result.deleted) {
    if (error) console.error("Unable to bind verified wallet profile to Clerk", { code: error.code });
    throw new Error("CLERK_PROFILE_BIND_FAILED");
  }
  return result.profileWallet;
}

async function bindVerifiedExternalClerkProfile(
  user: ClerkUserSnapshot,
  identity: { provider: "google" | "apple" | "telegram"; subjectHash: string },
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("bind_clerk_profile_from_verified_external", {
    ...clerkBindingMetadata(user),
    p_provider: identity.provider,
    p_subject_hash: identity.subjectHash,
  });
  const result = parseClerkProfileLink(data);
  if (error || !result || result.deleted) {
    if (error) console.error("Unable to bind verified social profile to Clerk", { code: error.code });
    throw new Error("CLERK_PROFILE_BIND_FAILED");
  }
  return result.profileWallet;
}

async function resolveCanonicalProfile(
  user: ClerkUserSnapshot,
  knownLink: ClerkProfileLinkResult | null = null,
) {
  const existing = knownLink ?? await getClerkProfileLink(user.id);
  if (existing && !existing.deleted) return existing.profileWallet;

  const legacy = await legacySessionCandidate();
  if (legacy) {
    return bindLegacyClerkProfile(user, legacy.tokenHash);
  }
  const verifiedSolana = await existingVerifiedSolanaCandidate(user);
  if (verifiedSolana) return bindVerifiedWalletClerkProfile(user, verifiedSolana);

  const previousExternalProfile = await existingExternalIdentityCandidate(user);
  if (previousExternalProfile) {
    return bindVerifiedExternalClerkProfile(user, previousExternalProfile);
  }
  return syncNewClerkProfile(user);
}

export async function getWalletSession(): Promise<WalletSession | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const existing = await getClerkProfileLink(userId);
  let profile: WalletProfile | null = null;
  let user: ClerkUserSnapshot | null = null;
  if (existing && !existing.deleted) {
    profile = await loadProfile(existing.profileWallet);
  } else {
    const client = await clerkClient();
    user = (await client.users.getUser(userId)) as ClerkUserSnapshot;
    const profileWallet = await resolveCanonicalProfile(user, existing);
    profile = await loadProfile(profileWallet);
  }
  if (!profile) throw new Error("CANONICAL_PROFILE_MISSING");

  const tokenExpiry = sessionClaims && typeof sessionClaims.exp === "number"
    ? new Date(sessionClaims.exp * 1_000)
    : new Date(Date.now() + SESSION_TTL_SECONDS * 1_000);

  return {
    walletAddress: profile.wallet_address,
    profile,
    expiresAt: tokenExpiry.toISOString(),
    authProvider: user ? authProviderForUser(user) : authProviderForProfile(profile),
  };
}

export async function requireWalletSession() {
  const session = await getWalletSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
