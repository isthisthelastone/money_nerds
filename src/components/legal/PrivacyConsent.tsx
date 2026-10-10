"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import type { PrivacyChoice } from "@/lib/privacy";

const PrivacyContext = createContext({ optionalViews: false, openSettings: () => {} });
export function usePrivacyConsent() { return useContext(PrivacyContext); }
export function PrivacyChoicesButton() {
  const { t } = useI18n();
  const { openSettings } = usePrivacyConsent();
  return <button type="button" onClick={openSettings} className="privacy-link">{t("Privacy choices")}</button>;
}

export function PrivacyConsentProvider({ initialChoice, children }: { initialChoice: PrivacyChoice; children: ReactNode }) {
  const { t } = useI18n();
  const [choice, setChoice] = useState(initialChoice);
  const [open, setOpen] = useState(initialChoice === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clearTimeout(timer); };
  }, [open]);
  async function save(next: Exclude<PrivacyChoice, null>) {
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/settings/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice: next }) });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { choice: Exclude<PrivacyChoice, null> };
      setChoice(payload.choice); setOpen(false);
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <PrivacyContext.Provider value={{ optionalViews: choice === "all", openSettings: () => { setScrolling(false); setOpen(true); } }}>
    {children}
    {open ? <section className="privacy-panel" data-scrolling={scrolling} aria-label={t("Privacy choices")}>
      <button className="privacy-panel__close" type="button" disabled={busy} aria-label={t("Necessary only")} title={t("Necessary only")} onClick={() => void save("necessary")}><X size={16} aria-hidden="true" /></button>
      <div className="privacy-panel__copy">
        <h2>{t("Cookies and local storage")}</h2>
        <p>{t("Necessary storage keeps sign-in, security, your chosen language and requested transfer recovery working. Optional storage counts unique post views. We do not add advertising cookies.")}</p>
        <p>{t("You can change this choice at any time in the footer or settings.")} <Link href="/legal/cookies">{t("Cookies and local storage")}</Link></p>
      </div>
      <div className="privacy-panel__actions">
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save("necessary")}>{t("Necessary only")}</button>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save("all")}>{t("Allow optional view counting")}</button>
      </div>
      {error ? <p role="alert">{t("Preferences could not be saved. Try again.")}</p> : null}
    </section> : null}
  </PrivacyContext.Provider>;
}
