import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { WalletProfile, WalletSession } from "@/lib/models";

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const createOpaqueSessionToken = () => randomBytes(32).toString("base64url");

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function getWalletSession(): Promise<WalletSession | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const supabase = createAdminSupabase();
  const { data: session, error } = await supabase
    .from("wallet_sessions")
    .select("wallet_address, expires_at, revoked_at")
    .eq("token_hash", hashSessionToken(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_address, display_name, bio, created_at, updated_at")
    .eq("wallet_address", session.wallet_address)
    .maybeSingle();

  return {
    walletAddress: session.wallet_address as string,
    profile: (profile as WalletProfile | null) ?? null,
    expiresAt: session.expires_at as string,
  };
}

export async function requireWalletSession() {
  const session = await getWalletSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
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

