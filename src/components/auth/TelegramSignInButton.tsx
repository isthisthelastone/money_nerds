"use client";

import { ArrowUpRight, RefreshCw, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { isTelegramAuthorizationUrl, isTelegramNativeAuthorizationUrl } from "@/lib/auth/telegram-links";

interface LegacyTelegramLoginConfig {
  flow: "legacy";
  authUrl: string;
  botUsername: string;
}

interface NativeTelegramLoginConfig {
  authUrl: string;
  nativeUrl: string;
  expiresAt: string;
}

// A timestamp is only a UI hint. The transaction, PKCE verifier and native link
// remain in the authenticated HttpOnly cookie, never in browser storage.
const PENDING_TELEGRAM_KEY = "mn_telegram_pending_v1";

function rememberPendingSignIn(expiresAt: string | null) {
  try {
    if (expiresAt) window.sessionStorage.setItem(PENDING_TELEGRAM_KEY, expiresAt);
    else window.sessionStorage.removeItem(PENDING_TELEGRAM_KEY);
  } catch {
    // Private browsing/storage restrictions must not prevent authentication.
  }
}

function readNativeConfig(payload: unknown): NativeTelegramLoginConfig | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (
    value.flow !== "oidc" || !isTelegramAuthorizationUrl(value.authUrl) ||
    !isTelegramNativeAuthorizationUrl(value.nativeUrl) || typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()
  ) return null;
  return { authUrl: value.authUrl, nativeUrl: value.nativeUrl, expiresAt: value.expiresAt };
}

function normalizeReturnTo(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function TelegramSignInButton({ returnTo = "/" }: { returnTo?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [config, setConfig] = useState<LegacyTelegramLoginConfig | null>(null);
  const [nativeConfig, setNativeConfig] = useState<NativeTelegramLoginConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pending = false;
    try {
      pending = Date.parse(window.sessionStorage.getItem(PENDING_TELEGRAM_KEY) ?? "") > Date.now();
    } catch {
      // The live page still works when storage is unavailable.
    }
    if (pending) {
      const controller = new AbortController();
      requestRef.current = controller;
      void fetch("/api/auth/telegram?resume=1", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }).then(async (response) => {
        const restored = response.ok ? readNativeConfig(await response.json()) : null;
        if (controller.signal.aborted) return;
        if (restored) setNativeConfig(restored);
        else rememberPendingSignIn(null);
      }).catch(() => {
        // Keep the hint on transient network failure; the start button remains usable.
      });
    }
    return () => requestRef.current?.abort();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    const widget = widgetRef.current;
    if (!config || !dialog || !widget) return;

    widget.replaceChildren();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", config.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-auth-url", config.authUrl);
    const handleScriptError = () => {
      setError("Telegram could not load its secure login control. Check your connection and retry.");
    };
    script.addEventListener("error", handleScriptError, { once: true });
    widget.append(script);
    if (!dialog.open) dialog.showModal();

    return () => {
      script.removeEventListener("error", handleScriptError);
      widget.replaceChildren();
    };
  }, [config]);

  const openNativeApp = (prepared: NativeTelegramLoginConfig) => {
    if (Date.parse(prepared.expiresAt) <= Date.now()) {
      setError("This sign-in has expired. Choose Start again for a fresh request.");
      return;
    }
    setError(null);
    try {
      window.location.assign(prepared.nativeUrl);
    } catch {
      setError("Telegram could not open. Choose Continue in browser below.");
    }
  };

  const prepare = async (preferNative = false) => {
    if (busy) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError(null);
    setNativeConfig(null);
    rememberPendingSignIn(null);
    try {
      const startUrl = new URL("/api/auth/telegram", window.location.origin);
      startUrl.searchParams.set("returnTo", normalizeReturnTo(returnTo));
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (mobile || preferNative) startUrl.searchParams.set("native", "1");
      const response = await fetch(startUrl, {
        cache: "no-store", credentials: "same-origin", signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        flow?: unknown;
        authUrl?: unknown;
        botUsername?: unknown;
        error?: unknown;
        nativeUrl?: unknown;
        expiresAt?: unknown;
      } | null;
      if (controller.signal.aborted) return;
      if (
        !response.ok ||
        typeof payload?.authUrl !== "string" ||
        (payload.flow !== "oidc" && payload.flow !== "legacy")
      ) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Telegram sign-in is unavailable.",
        );
      }
      const authUrl = new URL(payload.authUrl);
      if (payload.flow === "oidc") {
        if (!isTelegramAuthorizationUrl(payload.authUrl)) {
          throw new Error("Telegram returned an invalid authorization address.");
        }
        const prepared = readNativeConfig(payload);
        if (prepared) {
          setNativeConfig(prepared);
          rememberPendingSignIn(prepared.expiresAt);
          openNativeApp(prepared);
          return;
        }
        window.location.assign(authUrl.href);
        return;
      }

      const localHttp = authUrl.protocol === "http:" &&
        (authUrl.hostname === "localhost" || authUrl.hostname === "127.0.0.1");
      if (
        typeof payload.botUsername !== "string" ||
        !/^[A-Za-z0-9_]{5,32}$/.test(payload.botUsername) ||
        (authUrl.protocol !== "https:" && !localHttp) ||
        !authUrl.pathname.startsWith("/api/auth/telegram/callback/")
      ) {
        throw new Error("Telegram returned an invalid callback address.");
      }
      setConfig({ flow: "legacy", authUrl: authUrl.href, botUsername: payload.botUsername });
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : "Telegram sign-in could not be started.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-sky-400/30 bg-sky-400/10 px-5 py-3 font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-400/15 disabled:cursor-wait disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={() => nativeConfig ? openNativeApp(nativeConfig) : void prepare()}
      >
        {busy ? (
          <RefreshCw className="spin" aria-hidden="true" size={19} />
        ) : (
          <Send aria-hidden="true" size={19} />
        )}
        {nativeConfig ? "Open Telegram" : "Continue with Telegram"}
      </button>
      {!nativeConfig ? (
        <button
          className="mt-1 min-h-11 w-full text-xs font-semibold text-sky-200 underline decoration-sky-300/30 underline-offset-4 hover:text-sky-100 disabled:cursor-wait disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={() => void prepare(true)}
        >
          Use the Telegram app
        </button>
      ) : null}
      {nativeConfig ? (
        <div className="mt-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4" role="status">
          <p className="text-sm font-semibold text-nerd-paper">Approve in Telegram to come back here</p>
          <p className="mt-2 text-xs leading-relaxed text-nerd-muted">
            Telegram should reopen this browser after approval. If it stays open,
            switch back here and choose Continue in browser. Use the same browser
            where you started; your request is kept for 10 minutes. Browser fallback
            may ask you to approve again.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-nerd-muted">
            Telegram may show our sign-in server’s location. Check that the website
            is Money Nerds, and only approve a login you started.
          </p>
          <a
            className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-nerd-paper hover:bg-white/5"
            href={nativeConfig.authUrl}
            referrerPolicy="no-referrer"
            rel="external nofollow"
          >
            Continue in browser <ArrowUpRight aria-hidden="true" size={15} />
          </a>
          <button
            className="mt-2 min-h-11 w-full text-xs text-nerd-muted hover:text-nerd-paper disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void prepare(true)}
          >
            Start again
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-nerd-muted">
          Approve securely in the Telegram app. If the app cannot open, Telegram’s
          browser sign-in is available as a fallback. On phones, the approval may
          show our sign-in server’s location. Only approve a login you started for
          Money Nerds.
        </p>
      )}
      {error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <dialog
        ref={dialogRef}
        className="donation-dialog telegram-login-dialog"
        aria-labelledby={titleId}
        onCancel={() => setConfig(null)}
        onClose={() => setConfig(null)}
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
          <p>Telegram verifies your account, then Clerk creates your Money Nerds session.</p>
          <div ref={widgetRef} className="telegram-login-dialog__widget" />
        </div>
      </dialog>
    </>
  );
}
