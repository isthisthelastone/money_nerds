"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  Apple,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  LogOut,
  MoreHorizontal,
  RefreshCw,
  Send,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";
import type { WalletSession } from "@/lib/models";

type ExternalProvider = Exclude<WalletSession["authProvider"], "wallet">;

interface ExternalProviderAvailability {
  provider: ExternalProvider;
  available: true;
  startUrl: string;
  botUsername?: string;
}

interface TelegramLoginConfig {
  authUrl: string;
  botUsername: string;
}

const EXTERNAL_PROVIDER_ORDER: ExternalProvider[] = ["google", "apple", "telegram"];
const EXTERNAL_PROVIDER_LABELS: Record<ExternalProvider, string> = {
  google: "Google",
  apple: "Apple",
  telegram: "Telegram",
};

function providerStartPath(provider: ExternalProvider) {
  return provider === "telegram" ? "/api/auth/telegram" : `/api/auth/oauth/${provider}`;
}

function readAvailableProviders(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const providers = (value as { providers?: unknown }).providers;
  if (!providers || typeof providers !== "object" || Array.isArray(providers)) return [];

  return EXTERNAL_PROVIDER_ORDER.flatMap((provider) => {
    const candidate = (providers as Record<string, unknown>)[provider];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const status = candidate as Record<string, unknown>;
    if (
      status.provider !== provider ||
      status.available !== true ||
      status.startUrl !== providerStartPath(provider)
    ) return [];
    if (
      provider === "telegram" &&
      (typeof status.botUsername !== "string" ||
        !/^[A-Za-z0-9_]{5,32}$/.test(status.botUsername))
    ) return [];
    return [status as unknown as ExternalProviderAvailability];
  });
}

function currentReturnTo() {
  const current = new URL(window.location.href);
  current.searchParams.delete("auth");
  current.searchParams.delete("auth_error");
  return `${current.pathname}${current.search}${current.hash}`;
}

function externalAuthErrorMessage(code: string) {
  if (code === "provider_denied") return "Sign-in was cancelled in the provider window.";
  if (code === "too_many_requests") return "Too many sign-in attempts. Wait a minute and retry.";
  if (code === "expired") return "That sign-in request expired. Start again.";
  if (code === "provider_unavailable") return "That sign-in method is temporarily unavailable.";
  return "Sign-in could not be completed. Try again.";
}

function ExternalProviderIcon({ provider }: { provider: ExternalProvider }) {
  if (provider === "apple") return <Apple aria-hidden="true" size={17} />;
  if (provider === "telegram") return <Send aria-hidden="true" size={17} />;
  return <Globe aria-hidden="true" size={17} />;
}

function TelegramLoginDialog({
  config,
  onClose,
}: {
  config: TelegramLoginConfig | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const widget = widgetRef.current;
    if (!config || !dialog || !widget) return;

    setScriptError(null);
    widget.replaceChildren();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", config.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-auth-url", config.authUrl);
    const handleScriptError = () => {
      setScriptError("Telegram could not load its secure login control. Check your connection and retry.");
    };
    script.addEventListener("error", handleScriptError, { once: true });
    widget.append(script);
    if (!dialog.open) dialog.showModal();

    return () => {
      script.removeEventListener("error", handleScriptError);
      widget.replaceChildren();
    };
  }, [config]);

  return (
    <dialog
      ref={dialogRef}
      className="donation-dialog telegram-login-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="donation-dialog-inner telegram-login-dialog__inner">
        <button
          className="donation-close"
          type="button"
          aria-label="Close Telegram sign-in"
          onClick={() => dialogRef.current?.close()}
        >
          <X aria-hidden="true" size={18} />
        </button>
        <span className="eyebrow">Secure sign-in</span>
        <h2 id={titleId}>Continue with Telegram</h2>
        <p>Telegram verifies your account and returns a signed login response to Money Nerds.</p>
        <div
          ref={widgetRef}
          className="telegram-login-dialog__widget"
        />
        {scriptError ? (
          <p className="form-message error" role="alert">
            {scriptError}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}

function ExternalSignInOptions() {
  const optionsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ExternalProviderAvailability[]>([]);
  const [busyProvider, setBusyProvider] = useState<ExternalProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [telegramConfig, setTelegramConfig] = useState<TelegramLoginConfig | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/providers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("PROVIDERS_UNAVAILABLE");
        const payload = (await response.json()) as unknown;
        if (!controller.signal.aborted) setProviders(readAvailableProviders(payload));
      })
      .catch((caught: unknown) => {
        if (
          !controller.signal.aborted &&
          !(caught instanceof DOMException && caught.name === "AbortError")
        ) {
          setProviders([]);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const current = new URL(window.location.href);
    const authError = current.searchParams.get("auth_error");
    const errorTimer = authError
      ? window.setTimeout(() => setError(externalAuthErrorMessage(authError)), 0)
      : null;
    if (current.searchParams.has("auth") || current.searchParams.has("auth_error")) {
      current.searchParams.delete("auth");
      current.searchParams.delete("auth_error");
      window.history.replaceState(
        window.history.state,
        "",
        `${current.pathname}${current.search}${current.hash}`,
      );
    }
    return () => {
      if (errorTimer !== null) window.clearTimeout(errorTimer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const start = async (status: ExternalProviderAvailability) => {
    if (busyProvider) return;
    setBusyProvider(status.provider);
    setError(null);
    try {
      const startUrl = new URL(status.startUrl, window.location.origin);
      if (startUrl.origin !== window.location.origin || startUrl.pathname !== status.startUrl) {
        throw new Error("The sign-in method returned an invalid address.");
      }
      startUrl.searchParams.set("returnTo", currentReturnTo());
      if (status.provider !== "telegram") {
        window.location.assign(startUrl.href);
        return;
      }

      const response = await fetch(startUrl.href, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as {
        authUrl?: unknown;
        botUsername?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Telegram sign-in could not be prepared.",
        );
      }
      if (
        typeof payload?.authUrl !== "string" ||
        typeof payload.botUsername !== "string" ||
        payload.botUsername !== status.botUsername
      ) {
        throw new Error("Telegram returned an invalid login configuration.");
      }
      const authUrl = new URL(payload.authUrl);
      const localHttp = authUrl.protocol === "http:" &&
        (authUrl.hostname === "localhost" || authUrl.hostname === "127.0.0.1");
      if (
        (authUrl.protocol !== "https:" && !localHttp) ||
        !authUrl.pathname.startsWith("/api/auth/telegram/callback/")
      ) {
        throw new Error("Telegram returned an invalid callback address.");
      }
      setOpen(false);
      setTelegramConfig({ authUrl: authUrl.href, botUsername: payload.botUsername });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in could not be started.");
    } finally {
      setBusyProvider(null);
    }
  };

  if (providers.length === 0) {
    return error ? (
      <span className="sr-only" role="status" aria-live="polite">
        {error}
      </span>
    ) : null;
  }

  return (
    <div ref={optionsRef} className="external-auth-options">
      <button
        className="auth-options-trigger"
        type="button"
        aria-label="Other sign-in options"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Other sign-in options"
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal aria-hidden="true" size={18} />
      </button>
      {open ? (
        <div className="external-auth-popover" role="menu" aria-label="Other sign-in options">
          <div className="external-auth-popover__head">
            <strong>Sign in without a wallet</strong>
            <span>Your provider ID stays private.</span>
          </div>
          {providers.map((provider) => (
            <button
              key={provider.provider}
              type="button"
              role="menuitem"
              disabled={busyProvider !== null}
              onClick={() => void start(provider)}
            >
              {busyProvider === provider.provider ? (
                <RefreshCw className="spin" aria-hidden="true" size={17} />
              ) : (
                <ExternalProviderIcon provider={provider.provider} />
              )}
              Continue with {EXTERNAL_PROVIDER_LABELS[provider.provider]}
            </button>
          ))}
          {error ? (
            <p className="external-auth-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <TelegramLoginDialog config={telegramConfig} onClose={() => setTelegramConfig(null)} />
    </div>
  );
}

export function WalletControl() {
  const wallet = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { session, status, authenticated, error, retrySignIn, disconnect } =
    useWalletSession();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const externalSession = authenticated && session?.authProvider !== "wallet" ? session : null;
  const address = externalSession
    ? externalSession.walletAddress
    : wallet.publicKey?.toBase58() ?? session?.walletAddress;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (status === "loading") {
    return (
      <button className="button button-secondary wallet-status" type="button" disabled>
        <RefreshCw className="spin" aria-hidden="true" size={17} />
        Checking session
      </button>
    );
  }

  if (externalSession) {
    const provider = externalSession.authProvider as ExternalProvider;
    const providerLabel = EXTERNAL_PROVIDER_LABELS[provider];
    const profileLabel = externalSession.profile?.display_name?.trim() || `${providerLabel} member`;
    return (
      <div ref={menuRef} className="wallet-menu">
        <button
          className="wallet-trigger external-identity-trigger"
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
        >
          <ExternalProviderIcon provider={provider} />
          <span>{profileLabel}</span>
          <ChevronDown aria-hidden="true" size={15} />
        </button>
        {open ? (
          <div className="wallet-popover" role="menu">
            <div className="wallet-popover-head">
              <span>Signed in with {providerLabel}</span>
              <strong>{profileLabel}</strong>
              <small>Profile {formatWallet(externalSession.walletAddress, 5, 5)}</small>
            </div>
            <Link
              role="menuitem"
              href={`/u/${externalSession.walletAddress}`}
              onClick={() => setOpen(false)}
            >
              <UserRound aria-hidden="true" size={16} />
              Public profile
            </Link>
            <button role="menuitem" type="button" onClick={() => void copy()}>
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
              {copied ? "Copied" : "Copy profile ID"}
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                void disconnect();
              }}
            >
              <LogOut aria-hidden="true" size={16} />
              Disconnect
            </button>
          </div>
        ) : null}
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "Profile ID copied" : ""}
        </span>
      </div>
    );
  }

  if (!wallet.connected || !address) {
    const selectedWallet = wallet.wallet;
    const canReconnect = Boolean(
      selectedWallet &&
      (selectedWallet.readyState === WalletReadyState.Installed ||
        selectedWallet.readyState === WalletReadyState.Loadable),
    );
    const opensWalletApp = selectedWallet?.readyState === WalletReadyState.Loadable;
    const connect = () => {
      setConnectionError(null);
      if (!canReconnect) {
        setWalletModalVisible(true);
        return;
      }
      void wallet.connect().catch((caught: unknown) => {
        setConnectionError(
          caught instanceof Error ? caught.message : "The wallet could not be opened. Try again.",
        );
      });
    };
    const visibleError = connectionError ?? error;

    return (
      <div className="wallet-error-wrap">
        <div className="wallet-auth-actions">
          <button
            className="mn-wallet-button"
            type="button"
            disabled={wallet.connecting}
            onClick={connect}
          >
            {wallet.connecting ? (
              <RefreshCw className="spin" aria-hidden="true" size={17} />
            ) : (
              <Wallet aria-hidden="true" size={17} />
            )}
            {wallet.connecting
              ? "Opening wallet"
              : opensWalletApp
                ? `Open ${selectedWallet?.adapter.name ?? "wallet"}`
                : canReconnect
                  ? `Reconnect ${selectedWallet?.adapter.name ?? "wallet"}`
                  : "Connect wallet"}
          </button>
          <ExternalSignInOptions />
        </div>
        {visibleError ? (
          <span className="wallet-error-message" role="status" aria-live="polite">
            {visibleError}
          </span>
        ) : null}
      </div>
    );
  }

  if (status === "signing" || status === "preparing") {
    return (
      <button className="button button-secondary wallet-status" type="button" disabled>
        <RefreshCw className="spin" aria-hidden="true" size={17} />
        {status === "signing" ? "Check wallet" : "Preparing"}
      </button>
    );
  }

  if (!authenticated) {
    return (
      <div className="wallet-error-wrap">
        <div className="wallet-auth-actions">
          <button className="button button-accent" type="button" onClick={() => void retrySignIn()}>
            <RefreshCw aria-hidden="true" size={17} />
            {error ? "Retry sign-in" : "Sign to continue"}
          </button>
          <ExternalSignInOptions />
        </div>
        {error ? (
          <span className="wallet-error-message" role="status" aria-live="polite">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="wallet-menu">
      <button
        className="wallet-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="wallet-dot" aria-hidden="true" />
        <span>{formatWallet(address)}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {open ? (
        <div className="wallet-popover" role="menu">
          <div className="wallet-popover-head">
            <span>Connected on Solana</span>
            <strong>{formatWallet(address, 6, 6)}</strong>
          </div>
          <Link role="menuitem" href={`/u/${address}`} onClick={() => setOpen(false)}>
            <ExternalLink aria-hidden="true" size={16} />
            Public profile
          </Link>
          <button role="menuitem" type="button" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            {copied ? "Copied" : "Copy address"}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            <LogOut aria-hidden="true" size={16} />
            Disconnect
          </button>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Wallet address copied" : ""}
      </span>
    </div>
  );
}
