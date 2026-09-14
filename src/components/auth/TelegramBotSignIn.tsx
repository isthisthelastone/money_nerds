"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

/** Optional route: the documented OIDC button above remains the default. */
export function TelegramBotSignIn({ returnTo }: { returnTo: string }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/telegram/bot", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setAvailable(data?.available === true); })
      .catch(() => { /* The primary login stays available if this option is unavailable. */ });
    return () => controller.abort();
  }, []);

  const prepare = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const response = await fetch("/api/auth/telegram/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ returnTo }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.authUrl !== "string") {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not prepare Telegram. Please retry.");
      }
      const url = new URL(data.authUrl);
      if (url.protocol !== "https:" || url.hostname !== "t.me" || url.username || url.password ||
          !/^\/[A-Za-z0-9_]{5,32}$/.test(url.pathname) || !/^[A-Za-z0-9_-]{22,64}$/.test(url.searchParams.get("start") ?? "")) {
        throw new Error("Telegram returned an invalid bot link.");
      }
      setLink(url.href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Please retry Telegram sign-in.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (!available) return null;
  return (
    <details className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-sky-100">Need a return button from the Telegram app?</summary>
      <p className="mt-3 text-xs leading-relaxed text-nerd-muted">
        Try bot-assisted sign-in. Start here, open Telegram, tap Start if asked, then
        “Approve & return”. The return page has an Open Brave button for iPhone.
        Finish in the same browser and browsing mode where you started.
      </p>
      {link ? (
        <>
          <a className="button button-secondary mt-3 w-full" href={link} rel="noreferrer external nofollow">
            Open Telegram bot <ExternalLink size={15} aria-hidden="true" />
          </a>
          <p className="mt-2 text-xs text-nerd-muted">This private login attempt expires in 10 minutes. Never forward the bot link or return link.</p>
          <button className="mt-3 text-xs text-sky-200 underline" type="button" onClick={() => void prepare()} disabled={busy}>Start a new attempt</button>
        </>
      ) : (
        <button className="button button-secondary mt-3 w-full" type="button" onClick={() => void prepare()} disabled={busy}>
          {busy ? <RefreshCw size={15} className="spin" aria-hidden="true" /> : null}
          {busy ? "Preparing…" : "Prepare bot-assisted sign-in"}
        </button>
      )}
      {error ? <p role="alert" className="mt-3 text-xs text-red-300">{error}</p> : null}
    </details>
  );
}
