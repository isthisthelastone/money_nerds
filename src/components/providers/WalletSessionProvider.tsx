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
const LAST_WALLET_STORAGE_KEY = "money-nerds:last-solana-wallet";

function readRememberedWallet() {
  try {
    return window.localStorage.getItem(LAST_WALLET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberWallet(name: string | null) {
  try {
    if (name) window.localStorage.setItem(LAST_WALLET_STORAGE_KEY, name);
    else window.localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
  } catch {
    // Wallet Adapter can still connect when storage is unavailable; only automatic
    // restoration across an iOS page lifecycle is lost.
  }
}

interface PreparedChallenge {
  id: string;
  message: string;
  walletAddress: string;
  expiresAt: string;
}

async function readSession() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) throw new Error("SESSION_CHECK_FAILED");
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
  const mounted = useRef(true);
  const sessionChecked = useRef(false);
  const sessionRef = useRef<WalletSession | null>(null);
  const sessionEpoch = useRef(0);
  const refreshPromise = useRef<Promise<WalletSession | null | undefined> | null>(null);
  const revokePromise = useRef<Promise<boolean> | null>(null);
  const revocationRequired = useRef(false);
  const pageLifecycleHidden = useRef(false);
  const preparedChallenge = useRef<PreparedChallenge | null>(null);
  const challengeRequest = useRef<{
    walletAddress: string;
    promise: Promise<PreparedChallenge | null>;
  } | null>(null);
  const walletAddress = wallet.connected ? (wallet.publicKey?.toBase58() ?? null) : null;
  const selectedWalletName = wallet.wallet?.adapter.name ?? null;
  const walletAddressRef = useRef<string | null>(walletAddress);
  const lastConnectedWallet = useRef<string | null>(walletAddress);

  const clearLocalSession = useCallback(
    (nextStatus: SessionStatus, nextError: string | null = null) => {
      sessionEpoch.current += 1;
      sessionRef.current = null;
      setSession(null);
      setStatus(nextStatus);
      setError(nextError);
    },
    [],
  );

  const invalidateSession = useCallback(
    (message = "Your session ended. Sign in again to continue.") => {
      sessionChecked.current = true;
      attemptedWallet.current = null;
      clearLocalSession("error", message);
    },
    [clearLocalSession],
  );

  const revokeServerSession = useCallback((): Promise<boolean> => {
    if (revokePromise.current) return revokePromise.current;

    const request = fetch("/api/auth/session", { method: "DELETE" })
      .then((response) => {
        const revoked = response.ok;
        revocationRequired.current = !revoked;
        return revoked;
      })
      .catch(() => {
        revocationRequired.current = true;
        return false;
      });
    revokePromise.current = request;
    void request.finally(() => {
      if (revokePromise.current === request) revokePromise.current = null;
    });
    return request;
  }, []);

  const prepareChallenge = useCallback(
    (address: string): Promise<PreparedChallenge | null> => {
      const existing = preparedChallenge.current;
      if (
        existing?.walletAddress === address &&
        new Date(existing.expiresAt).getTime() > Date.now() + 15_000
      ) {
        return Promise.resolve(existing);
      }
      const inFlight = challengeRequest.current;
      if (inFlight?.walletAddress === address) return inFlight.promise;

      const request = fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      })
        .then(async (response) => {
          const challenge = (await response.json()) as {
            id?: string;
            message?: string;
            expiresAt?: string;
            error?: string;
          };
          if (
            !response.ok ||
            !challenge.id ||
            !challenge.message ||
            !challenge.expiresAt
          ) {
            throw new Error(challenge.error ?? "Could not prepare wallet sign-in.");
          }
          const nextChallenge: PreparedChallenge = {
            id: challenge.id,
            message: challenge.message,
            walletAddress: address,
            expiresAt: challenge.expiresAt,
          };
          if (
            walletAddressRef.current === address &&
            challengeRequest.current?.promise === request
          ) {
            preparedChallenge.current = nextChallenge;
          }
          return nextChallenge;
        })
        .catch((caught) => {
          if (
            mounted.current &&
            walletAddressRef.current === address &&
            challengeRequest.current?.promise === request
          ) {
            setError(caught instanceof Error ? caught.message : "Could not prepare wallet sign-in.");
            setStatus("error");
          }
          return null;
        });
      challengeRequest.current = { walletAddress: address, promise: request };
      void request.finally(() => {
        if (challengeRequest.current?.promise === request) challengeRequest.current = null;
      });
      return request;
    },
    [],
  );

  const refreshSession = useCallback(
    (reportError = true): Promise<WalletSession | null | undefined> => {
      if (refreshPromise.current) return refreshPromise.current;

      const epoch = sessionEpoch.current;
      const request = readSession()
        .then((nextSession) => {
          if (!mounted.current || epoch !== sessionEpoch.current) return nextSession;

          const hadSession = Boolean(sessionRef.current);
          sessionChecked.current = true;
          sessionRef.current = nextSession;
          setSession(nextSession);
          setError(null);

          const activeWallet = walletAddressRef.current;
          if (nextSession && nextSession.authProvider !== "wallet") {
            attemptedWallet.current = null;
            preparedChallenge.current = null;
            setStatus("authenticated");
          } else if (nextSession?.walletAddress === activeWallet) {
            setStatus("authenticated");
          } else if (!nextSession && hadSession) {
            setStatus("error");
            setError("Your session ended. Sign in again to continue.");
          } else if (signing.current) {
            setStatus("signing");
          } else if (activeWallet && challengeRequest.current?.walletAddress === activeWallet) {
            // The initial cookie check and challenge prefetch run concurrently. Do
            // not expose an actionable Sign button until its challenge is ready.
            setStatus("preparing");
          } else {
            setStatus("disconnected");
          }
          return nextSession;
        })
        .catch(() => {
          if (!mounted.current || epoch !== sessionEpoch.current) return undefined;
          if (reportError || !sessionChecked.current) {
            setError("The wallet session could not be checked. Check your connection and retry.");
            if (!sessionRef.current) setStatus("error");
          }
          return undefined;
        });
      refreshPromise.current = request;
      void request.finally(() => {
        if (refreshPromise.current === request) refreshPromise.current = null;
      });
      return request;
    },
    [],
  );

  const signIn = useCallback(async (prepared?: PreparedChallenge | null) => {
    if (sessionRef.current && sessionRef.current.authProvider !== "wallet") return;
    const signingWallet = wallet.publicKey?.toBase58();
    if (!wallet.connected || !signingWallet || !wallet.signMessage || signing.current) {
      if (wallet.connected && !wallet.signMessage) {
        setError("This wallet cannot sign login messages. Choose another Solana wallet.");
        setStatus("error");
      }
      return;
    }

    signing.current = true;
    attemptedWallet.current = signingWallet;
    sessionEpoch.current += 1;
    setError(null);
    setStatus("signing");

    try {
      const challenge = prepared ?? preparedChallenge.current;
      if (
        !challenge ||
        challenge.walletAddress !== signingWallet ||
        new Date(challenge.expiresAt).getTime() <= Date.now() + 5_000
      ) {
        throw new Error("The sign-in request expired. Retry to prepare a new one.");
      }

      // Retry keeps this adjacent to the click. Fresh Phantom iOS and MetaMask
      // connections also continue here through their injected/relay providers;
      // Android Mobile Wallet Adapter is excluded from that automatic path.
      const signature = await wallet.signMessage(
        new TextEncoder().encode(challenge.message),
      );
      if (
        revocationRequired.current ||
        (sessionRef.current && sessionRef.current.walletAddress !== signingWallet)
      ) {
        const revoked = await revokeServerSession();
        if (!revoked) {
          throw new Error("The previous wallet session could not be closed. Check your connection and retry.");
        }
        sessionRef.current = null;
        setSession(null);
      } else if (revokePromise.current) {
        const revoked = await revokePromise.current;
        if (!revoked) {
          throw new Error("The previous wallet session could not be closed. Check your connection and retry.");
        }
      }

      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          walletAddress: signingWallet,
          signature: bs58.encode(signature),
        }),
      });
      const verified = (await verifyResponse.json()) as { error?: string };
      if (!verifyResponse.ok) {
        throw new Error(verified.error ?? "Wallet sign-in failed.");
      }
      preparedChallenge.current = null;

      const nextSession = await readSession();
      sessionChecked.current = true;
      if (!nextSession || nextSession.walletAddress !== signingWallet) {
        throw new Error("The wallet session could not be confirmed.");
      }
      if (walletAddressRef.current !== signingWallet) {
        const earlierRevocation = revokePromise.current;
        if (earlierRevocation) {
          await earlierRevocation;
          if (revokePromise.current === earlierRevocation) revokePromise.current = null;
        }
        const revoked = await revokeServerSession();
        if (!revoked) revocationRequired.current = true;
        throw new Error("The connected wallet changed during sign-in. Retry with the active wallet.");
      }
      revocationRequired.current = false;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setStatus("authenticated");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet sign-in failed.");
      setStatus("error");
    } finally {
      signing.current = false;
    }
  }, [revokeServerSession, router, wallet]);

  useEffect(() => {
    mounted.current = true;
    void refreshSession();
    return () => {
      mounted.current = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (walletAddressRef.current !== walletAddress) preparedChallenge.current = null;
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const markHidden = () => {
      pageLifecycleHidden.current = true;
    };
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        pageLifecycleHidden.current = false;
        void refreshSession(false);
      }
    };
    const restoreFromPageCache = () => {
      pageLifecycleHidden.current = false;
      void refreshSession(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") markHidden();
      else refreshIfVisible();
    };
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    window.addEventListener("pagehide", markHidden);
    window.addEventListener("pageshow", restoreFromPageCache);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      window.removeEventListener("pagehide", markHidden);
      window.removeEventListener("pageshow", restoreFromPageCache);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!wallet.connected || !selectedWalletName) return;
    rememberWallet(selectedWalletName);
  }, [selectedWalletName, wallet.connected]);

  useEffect(() => {
    if (
      !session ||
      session.authProvider !== "wallet" ||
      wallet.connected ||
      wallet.connecting ||
      wallet.wallet
    ) return;
    const rememberedName = readRememberedWallet();
    if (!rememberedName) return;
    const rememberedWallet = wallet.wallets.find(
      ({ adapter }) => adapter.name === rememberedName,
    );
    if (rememberedWallet) wallet.select(rememberedWallet.adapter.name);
  }, [session, wallet]);

  useEffect(() => {
    if (!session) return;
    const expiresIn = new Date(session.expiresAt).getTime() - Date.now();
    const timeout = window.setTimeout(
      () => invalidateSession(),
      Number.isFinite(expiresIn) ? Math.max(0, expiresIn) : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [invalidateSession, session]);

  useEffect(() => {
    const previousWallet = lastConnectedWallet.current;
    lastConnectedWallet.current = walletAddress;

    // The cookie is the authoritative identity. A wallet restored in the
    // background must neither replace nor revoke an external-provider session.
    if (!sessionChecked.current || (session && session.authProvider !== "wallet")) {
      attemptedWallet.current = null;
      preparedChallenge.current = null;
      return;
    }

    if (!walletAddress) {
      if (previousWallet) {
        attemptedWallet.current = null;
        if (pageLifecycleHidden.current || document.visibilityState === "hidden") {
          // iOS wallet hand-offs and page reloads can emit a transient adapter
          // disconnect without `beforeunload`. Preserve the HTTP-only session;
          // the selected wallet is restored after the page becomes visible again.
          return;
        }
        void revokeServerSession().then((revoked) => {
          if (!mounted.current) return;
          clearLocalSession(
            revoked ? "disconnected" : "error",
            revoked
              ? null
              : "The wallet disconnected, but the server session could not be closed. Retry before reconnecting.",
          );
        });
      }
      return;
    }

    if (previousWallet && previousWallet !== walletAddress) {
      attemptedWallet.current = null;
      preparedChallenge.current = null;
      revocationRequired.current = true;
      clearLocalSession("preparing");
      void revokeServerSession().then((revoked) => {
        if (!mounted.current || walletAddressRef.current !== walletAddress) return;
        if (!revoked) {
          clearLocalSession(
            "error",
            "The previous wallet session could not be closed. Check your connection and retry.",
          );
          return;
        }
        revocationRequired.current = false;
        setStatus("preparing");
        setError(null);
        void prepareChallenge(walletAddress).then((nextChallenge) => {
          if (!mounted.current || walletAddressRef.current !== walletAddress) return;
          if (nextChallenge?.walletAddress === walletAddress) setStatus("disconnected");
        });
      });
      return;
    }

    if (
      status === "loading" ||
      status === "signing" ||
      status === "preparing" ||
      status === "error"
    ) return;

    if (session?.walletAddress === walletAddress) {
      attemptedWallet.current = null;
      return;
    }

    const challenge = preparedChallenge.current;
    if (
      challenge?.walletAddress === walletAddress &&
      new Date(challenge.expiresAt).getTime() > Date.now() + 15_000
    ) {
      setStatus("disconnected");
      return;
    }

    setStatus("preparing");
    setError(null);
    void prepareChallenge(walletAddress).then((nextChallenge) => {
      if (!mounted.current || walletAddressRef.current !== walletAddress) return;
      if (nextChallenge?.walletAddress === walletAddress) setStatus("disconnected");
    });
  }, [clearLocalSession, prepareChallenge, revokeServerSession, session, status, walletAddress]);

  useEffect(() => {
    if (
      !walletAddress ||
      !sessionChecked.current ||
      (session && session.authProvider !== "wallet") ||
      session?.walletAddress === walletAddress ||
      status !== "disconnected" ||
      signing.current ||
      attemptedWallet.current === walletAddress ||
      selectedWalletName === "Mobile Wallet Adapter"
    ) return;

    const challenge = preparedChallenge.current;
    if (
      !challenge ||
      challenge.walletAddress !== walletAddress ||
      new Date(challenge.expiresAt).getTime() <= Date.now() + 5_000
    ) return;

    // A fresh Phantom iOS or MetaMask connection should flow straight into its
    // signature request. Keep Android MWA on the explicit button path because
    // its app navigation must begin directly from a user gesture.
    attemptedWallet.current = walletAddress;
    void signIn(challenge);
  }, [selectedWalletName, session, signIn, status, walletAddress]);

  const retrySignIn = useCallback(async () => {
    attemptedWallet.current = null;
    setError(null);
    if (!sessionChecked.current) {
      const checkedSession = await refreshSession();
      if (checkedSession === undefined) return;
      if (checkedSession && checkedSession.authProvider !== "wallet") return;
      if (checkedSession?.walletAddress === walletAddressRef.current) return;
    }
    if (sessionRef.current && sessionRef.current.authProvider !== "wallet") {
      setStatus("authenticated");
      return;
    }
    if (sessionRef.current?.walletAddress === walletAddressRef.current) {
      setStatus("authenticated");
      return;
    }
    const address = walletAddressRef.current;
    let challenge = preparedChallenge.current;
    if (
      address &&
      (!challenge ||
        challenge.walletAddress !== address ||
        new Date(challenge.expiresAt).getTime() <= Date.now() + 5_000)
    ) {
      setStatus("preparing");
      setError(null);
      challenge = await prepareChallenge(address);
      if (!challenge || challenge.walletAddress !== address || walletAddressRef.current !== address) {
        return;
      }
    }
    await signIn(challenge);
  }, [prepareChallenge, refreshSession, signIn]);

  const disconnect = useCallback(async () => {
    setError(null);
    attemptedWallet.current = null;
    lastConnectedWallet.current = null;
    rememberWallet(null);
    const revoked = await revokeServerSession();
    await wallet.disconnect().catch(() => undefined);
    clearLocalSession(
      revoked ? "disconnected" : "error",
      revoked
        ? null
        : "Your session could not be closed. Check your connection and retry.",
    );
    router.refresh();
  }, [clearLocalSession, revokeServerSession, router, wallet]);

  const walletMatchesSession = Boolean(
    walletAddress && session?.authProvider === "wallet" && session.walletAddress === walletAddress,
  );
  const externalSessionAuthenticated = Boolean(session && session.authProvider !== "wallet");
  const identityMatchesSession = externalSessionAuthenticated || walletMatchesSession;
  const resolvedStatus: SessionStatus = status === "loading"
    ? "loading"
    : externalSessionAuthenticated
      ? "authenticated"
    : status === "preparing"
      ? "preparing"
    : status === "signing"
      ? "signing"
      : !walletAddress
        ? "disconnected"
        : walletMatchesSession
          ? "authenticated"
          : status === "error"
            ? "error"
            : "disconnected";

  const value = useMemo<WalletSessionContextValue>(
    () => ({
      session,
      status: resolvedStatus,
      authenticated: resolvedStatus === "authenticated" && identityMatchesSession,
      error,
      retrySignIn,
      disconnect,
      invalidateSession,
    }),
    [disconnect, error, identityMatchesSession, invalidateSession, resolvedStatus, retrySignIn, session],
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
