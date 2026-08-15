"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
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
}

const WalletSessionContext = createContext<WalletSessionContextValue | null>(null);

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { session: WalletSession | null };
  return payload.session;
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const router = useRouter();
  const [session, setSession] = useState<WalletSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const attemptedWallet = useRef<string | null>(null);
  const signing = useRef(false);

  useEffect(() => {
    let active = true;
    void readSession().then((value) => {
      if (!active) return;
      setSession(value);
      setStatus("disconnected");
    });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async () => {
    const walletAddress = wallet.publicKey?.toBase58();
    if (!wallet.connected || !walletAddress || !wallet.signMessage || signing.current) {
      if (wallet.connected && !wallet.signMessage) {
        setError("This wallet cannot sign login messages. Choose another Solana wallet.");
        setStatus("error");
      }
      return;
    }

    signing.current = true;
    attemptedWallet.current = walletAddress;
    setError(null);
    setStatus("signing");

    try {
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const challenge = (await challengeResponse.json()) as {
        id?: string;
        message?: string;
        error?: string;
      };
      if (!challengeResponse.ok || !challenge.id || !challenge.message) {
        throw new Error(challenge.error ?? "Could not start wallet sign-in.");
      }

      const signature = await wallet.signMessage(
        new TextEncoder().encode(challenge.message),
      );
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          walletAddress,
          signature: bs58.encode(signature),
        }),
      });
      const verified = (await verifyResponse.json()) as { error?: string };
      if (!verifyResponse.ok) {
        throw new Error(verified.error ?? "Wallet sign-in failed.");
      }

      const nextSession = await readSession();
      if (!nextSession || nextSession.walletAddress !== walletAddress) {
        throw new Error("The wallet session could not be confirmed.");
      }
      setSession(nextSession);
      setStatus("authenticated");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet sign-in failed.");
      setStatus("error");
    } finally {
      signing.current = false;
    }
  }, [router, wallet]);

  useEffect(() => {
    const walletAddress = wallet.publicKey?.toBase58();
    if (!wallet.connected || !walletAddress || status === "loading") return;

    if (session?.walletAddress === walletAddress) {
      attemptedWallet.current = null;
      return;
    }

    if (attemptedWallet.current !== walletAddress) {
      void signIn();
    }
  }, [session, signIn, status, wallet.connected, wallet.publicKey]);

  const retrySignIn = useCallback(async () => {
    attemptedWallet.current = null;
    await signIn();
  }, [signIn]);

  const disconnect = useCallback(async () => {
    setError(null);
    attemptedWallet.current = null;
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    await wallet.disconnect().catch(() => undefined);
    setSession(null);
    setStatus("disconnected");
    router.refresh();
  }, [router, wallet]);

  const walletMatchesSession = Boolean(
    wallet.connected && session?.walletAddress === wallet.publicKey?.toBase58(),
  );
  const resolvedStatus: SessionStatus =
    walletMatchesSession && status === "disconnected"
      ? "authenticated"
      : !wallet.connected && status === "authenticated"
        ? "disconnected"
        : status;

  const value = useMemo<WalletSessionContextValue>(
    () => ({
      session,
      status: resolvedStatus,
      authenticated: resolvedStatus === "authenticated" && walletMatchesSession,
      error,
      retrySignIn,
      disconnect,
    }),
    [disconnect, error, resolvedStatus, retrySignIn, session, walletMatchesSession],
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
