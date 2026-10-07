export const LOCALES = ["en", "es", "zh", "ru", "vi"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "mn_locale";
export const COUNTRY_COOKIE = "mn_country";
export const CONSENT_COOKIE = "mn_privacy";
export const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 180;

export const LANGUAGE_OPTIONS: Record<Locale, { name: string; flag: string; intl: string }> = {
  en: { name: "English", flag: "🇬🇧", intl: "en-GB" },
  es: { name: "Español", flag: "🇪🇸", intl: "es-ES" },
  zh: { name: "简体中文", flag: "🇨🇳", intl: "zh-CN" },
  ru: { name: "Русский", flag: "🇷🇺", intl: "ru-RU" },
  vi: { name: "Tiếng Việt", flag: "🇻🇳", intl: "vi-VN" },
};

export const EU_COUNTRIES = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"] as const;
export const LEGAL_COUNTRIES = ["GLOBAL", ...EU_COUNTRIES, "US", "RU", "SG", "MY"] as const;
export type LegalCountry = (typeof LEGAL_COUNTRIES)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.includes(value as Locale);
}
export function isLegalCountry(value: unknown): value is LegalCountry {
  return typeof value === "string" && LEGAL_COUNTRIES.includes(value as LegalCountry);
}
export function localeFromTag(value: unknown): Locale | null {
  if (typeof value !== "string") return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/** Country is only a coarse fallback, never an assertion of citizenship. */
export function localeFromCountry(country: string | null | undefined): Locale {
  if (country === "RU") return "ru";
  if (country === "VN") return "vi";
  if (["CN", "TW", "HK", "MO"].includes(country ?? "")) return "zh";
  if (["ES", "MX", "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "NI", "PA", "PE", "PR", "PY", "SV", "UY", "VE"].includes(country ?? "")) return "es";
  // Multilingual Singapore and Malaysia must not be assumed to speak Chinese.
  return DEFAULT_LOCALE;
}

export function browserLocale(acceptLanguage: string | null): Locale | null {
  const entries = (acceptLanguage ?? "").slice(0, 2048).split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const weight = params.find((param) => param.trim().startsWith("q="));
    return { locale: localeFromTag(tag), weight: weight ? Number(weight.trim().slice(2)) : 1, index };
  }).filter((entry) => entry.locale && Number.isFinite(entry.weight) && entry.weight > 0 && entry.weight <= 1);
  entries.sort((a, b) => b.weight - a.weight || a.index - b.index);
  return entries[0]?.locale ?? null;
}

export type Messages = Record<string, string>;
export type Translate = (source: string, values?: Record<string, string | number>) => string;
export function makeTranslator(messages: Messages): Translate {
  return (source, values) => {
    const text = messages[source] ?? source;
    return values ? text.replace(/\{(\w+)\}/g, (match, key: string) => Object.hasOwn(values, key) ? String(values[key]) : match) : text;
  };
}
