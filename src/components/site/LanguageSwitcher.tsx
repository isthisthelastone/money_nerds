"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { isLocale, LANGUAGE_OPTIONS, LOCALES, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: Locale) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: next }) });
      if (!response.ok) throw new Error();
      const url = new URL(window.location.href);
      if (/^\/(en|es|zh|ru|vi)\/how-it-works\/?$/.test(url.pathname)) {
        url.pathname = next === "en" ? "/how-it-works" : `/${next}/how-it-works`;
      }
      url.searchParams.set("ui", next);
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
      router.refresh();
    } catch { setError("Preferences could not be saved. Try again."); }
    finally { setBusy(false); }
  }

  return <div className={`language-switcher ${compact ? "language-switcher--compact" : ""}`}>
    <label htmlFor={id} className={compact ? "sr-only" : "language-switcher__label"}>{t("Choose language")}</label>
    <select id={id} value={locale} disabled={busy} aria-label={t("Choose language")} onChange={(event) => { if (isLocale(event.target.value)) void change(event.target.value); }}>
      {LOCALES.map((code) => <option key={code} value={code} lang={code}>{LANGUAGE_OPTIONS[code].flag} {LANGUAGE_OPTIONS[code].name}</option>)}
    </select>
    {!compact ? <div className="flex flex-wrap gap-2" aria-label={t("Choose language")}>
      {LOCALES.map(code => <button key={code} type="button" disabled={busy} aria-pressed={locale === code} lang={code} onClick={() => void change(code)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm ${locale === code ? "border-[#c9ff55]/50 text-[#c9ff55]" : "border-white/20"}`}><span aria-hidden="true">{LANGUAGE_OPTIONS[code].flag}</span>{LANGUAGE_OPTIONS[code].name}</button>)}
    </div> : null}
    {error ? <p role="alert" className="text-xs text-red-300">{t(error)}</p> : null}
  </div>;
}
