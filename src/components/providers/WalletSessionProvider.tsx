"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WalletSession } from "@/lib/models";

type SessionStatus =
  | "loading"
  | "preparing"
  | "disconnected"
  | "signing"
  | "authenticated"
  | "error";

interface WalletSessionContextValue {
  session: WalletSession | null;
  status: SessionStatus;
  authenticated: boolean;
  error: string | null;
  retrySignIn: () => Promise<void>;
  disconnect: () => Promise<void>;
  invalidateSession: (message?: string) => void;
}

const WalletSessionContext = createContext<WalletSessionContextValue | null>(null);

async function readSession(signal?: AbortSignal) {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "UNAUTHENTICATED" : "SESSION_CHECK_FAILED");
  }
  const payload = (await response.json()) as { session?: WalletSession | null };
  return payload.session ?? null;
}

function currentSignInUrl() {
  if (typeof window === "undefined") return "/sign-in";
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
}

/**
 * Compatibility layer for the original wallet-session API.
 *
 * Authentication is owned by Clerk. The session returned here contains the
 * canonical Supabase profile ID, so posts, comments, likes, donations, and
 * public profile URLs continue to use the same durable identity key.
 */
export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<WalletSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refreshSession = useCallback(async (signal?: AbortSignal) => {
    const version = ++requestVersion.current;
    setError(null);
    setStatus("preparing");

    try {
      const nextSession = await readSession(signal);
      if (signal?.aborted || version !== requestVersion.current) return;
      if (!nextSession) {
        setSession(null);
        setStatus("disconnected");
        return;
      }
      setSession(nextSession);
      setStatus("authenticated");
    } catch (caught) {
      if (signal?.aborted || version !== requestVersion.current) return;
      setSession(null);
      if (caught instanceof Error && caught.message === "UNAUTHENTICATED") {
        setStatus("disconnected");
        return;
      }
      setStatus("error");
      setError("Your Money Nerds profile could not be loaded. Check your connection and retry.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!isLoaded) {
      setStatus("loading");
      return () => controller.abort();
    }
    if (!isSignedIn || !userId) {
      requestVersion.current += 1;
      setSession(null);
      setError(null);
      setStatus("disconnected");
      return () => controller.abort();
    }
    void refreshSession(controller.signal);
    return () => controller.abort();
  }, [isLoaded, isSignedIn, refreshSession, userId]);

  const invalidateSession = useCallback(
    (message = "Your session ended. Sign in again to continue.") => {
      requestVersion.current += 1;
      setSession(null);
      setStatus("error");
      setError(message);
    },
    [],
  );

  const retrySignIn = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(currentSignInUrl());
      return;
    }
    await refreshSession();
    router.refresh();
  }, [isLoaded, isSignedIn, refreshSession, router]);

  const disconnect = useCallback(async () => {
    requestVersion.current += 1;
    setSession(null);
    setError(null);
    setStatus("disconnected");

    // Clear the legacy opaque cookie as part of the one-time migration. Clerk
    // remains the only active login session after this request.
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "same-origin",
    }).catch(() => undefined);
    await signOut({ redirectUrl: "/" });
  }, [signOut]);

  const value = useMemo<WalletSessionContextValue>(
    () => ({
      session,
      status,
      authenticated: Boolean(isSignedIn && session && status === "authenticated"),
      error,
      retrySignIn,
      disconnect,
      invalidateSession,
    }),
    [disconnect, error, invalidateSession, isSignedIn, retrySignIn, session, status],
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession() {
  const value = useContext(WalletSessionContext);
  if (!value) throw new Error("useWalletSession must be used within WalletSessionProvider");
  return value;
}
