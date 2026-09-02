"use client";

import { RefreshCw, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface TelegramLoginConfig {
  authUrl: string;
  botUsername: string;
}

function normalizeReturnTo(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

export function TelegramSignInButton({ returnTo = "/" }: { returnTo?: string }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<TelegramLoginConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const prepare = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const startUrl = new URL("/api/auth/telegram", window.location.origin);
      startUrl.searchParams.set("returnTo", normalizeReturnTo(returnTo));
      const response = await fetch(startUrl, { cache: "no-store", credentials: "same-origin" });
      const payload = (await response.json().catch(() => null)) as {
        authUrl?: unknown;
        botUsername?: unknown;
        error?: unknown;
      } | null;
      if (
        !response.ok ||
        typeof payload?.authUrl !== "string" ||
        typeof payload.botUsername !== "string"
      ) {
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Telegram sign-in is unavailable.",
        );
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
      setConfig({ authUrl: authUrl.href, botUsername: payload.botUsername });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Telegram sign-in could not be started.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-sky-400/30 bg-sky-400/10 px-5 py-3 font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-400/15 disabled:cursor-wait disabled:opacity-60"
        type="button"
        disabled={busy}
        onClick={() => void prepare()}
      >
        {busy ? (
          <RefreshCw className="spin" aria-hidden="true" size={19} />
        ) : (
          <Send aria-hidden="true" size={19} />
        )}
        Continue with Telegram
      </button>
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
