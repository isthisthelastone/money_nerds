"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { isLegalCountry, LEGAL_COUNTRIES, type LegalCountry } from "@/lib/i18n/config";
import { PrivacyChoicesButton } from "@/components/legal/PrivacyConsent";

export function PreferencesSettings() {
  const { locale, country, t } = useI18n();
  const [selected, setSelected] = useState<LegalCountry | "auto">(country);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });

  async function save(resetLanguage = false) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/settings/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(resetLanguage ? { locale: null } : { country: selected === "auto" ? null : selected }) });
      if (!response.ok) throw new Error();
      setMessage("Preferences saved.");
      if (resetLanguage) {
        const url = new URL(window.location.href); url.searchParams.delete("ui");
        router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
      }
      router.refresh();
    } catch { setMessage("Preferences could not be saved. Try again."); }
    finally { setBusy(false); }
  }

  return <section className="preferences-card" aria-labelledby="language-region-title">
    <h2 id="language-region-title">{t("Language and region")}</h2>
    <p>{t("Your language choice does not change your legal rights or the language of other people's posts.")}</p>
    <LanguageSwitcher />
    <button className="privacy-link" type="button" disabled={busy} onClick={() => void save(true)}>{t("Automatic")}</button>
    <p>{t("We use your saved preference, browser language and approximate IP country. You can override this at any time.")}</p>
    <label className="preferences-country">
      <span>{t("Legal country or region")}</span>
      <select value={selected} onChange={(event) => { if (event.target.value === "auto" || isLegalCountry(event.target.value)) setSelected(event.target.value); }}>
        <option value="auto">{t("Automatic")}</option>
        {LEGAL_COUNTRIES.map((code) => <option value={code} key={code}>{code === "GLOBAL" ? t("Global / other") : countryNames.of(code)}</option>)}
      </select>
    </label>
    <p>{t("Country is estimated, not verified. Select the country relevant to you; all notices remain available.")}</p>
    <div className="flex flex-wrap items-center gap-4">
      <button className="button button-secondary" type="button" disabled={busy} onClick={() => void save()}>{t(busy ? "Saving…" : "Save preferences")}</button>
      <PrivacyChoicesButton />
    </div>
    <p>{t("Signed-in preferences also follow your account. Guest preferences are saved in this browser for six months.")}</p>
    {message ? <p role="status">{t(message)}</p> : null}
  </section>;
}
