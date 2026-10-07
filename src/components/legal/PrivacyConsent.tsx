"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
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
  return <PrivacyContext.Provider value={{ optionalViews: choice === "all", openSettings: () => setOpen(true) }}>
    {children}
    {open ? <section className="privacy-panel" aria-label={t("Privacy choices")}>
      <div className="privacy-panel__copy">
        <h2>{t("Cookies and local storage")}</h2>
        <p>{t("Necessary storage keeps sign-in, security, your chosen language and requested transfer recovery working. Optional storage counts unique post views. We do not add advertising cookies.")}</p>
        <p>{t("You can change this choice at any time in the footer or settings.")} <Link href="/legal/cookies">{t("Cookies and local storage")}</Link></p>
      </div>
      <div className="privacy-panel__actions">
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save("necessary")}>{t("Necessary only")}</button>
        <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save("all")}>{t("Allow optional view counting")}</button>
        {choice ? <button className="privacy-link" type="button" onClick={() => setOpen(false)}>{t("Close")}</button> : null}
      </div>
      {error ? <p role="alert">{t("Preferences could not be saved. Try again.")}</p> : null}
    </section> : null}
  </PrivacyContext.Provider>;
}
