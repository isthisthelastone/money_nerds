"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeTranslator, type LegalCountry, type Locale, type Messages, type Translate } from "@/lib/i18n/config";

type I18nContextValue = { locale: Locale; country: LegalCountry; t: Translate };
const I18nContext = createContext<I18nContextValue>({ locale: "en", country: "GLOBAL", t: makeTranslator({}) });

export function I18nProvider({ locale, country, messages, children }: { locale: Locale; country: LegalCountry; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => ({ locale, country, t: makeTranslator(messages) }), [locale, country, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() { return useContext(I18nContext); }

/** Only pass site-owned copy. Never use this for user-generated text. */
export function T({ text, values }: { text: string; values?: Record<string, string | number> }) {
  return useI18n().t(text, values);
}
