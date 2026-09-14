import { SITE_URL } from "@/lib/config";

export const GUIDE_LANGUAGES = [
  { locale: "en", language: "en", label: "English", path: "/how-it-works", openGraphLocale: "en_US" },
  { locale: "ru", language: "ru", label: "Русский", path: "/ru/how-it-works", openGraphLocale: "ru_RU" },
  { locale: "es", language: "es", label: "Español", path: "/es/how-it-works", openGraphLocale: "es_ES" },
  { locale: "zh", language: "zh-Hans", label: "简体中文", path: "/zh/how-it-works", openGraphLocale: "zh_CN" },
] as const;

export type GuideLocale = (typeof GUIDE_LANGUAGES)[number]["locale"];
export type TranslatedGuideLocale = Exclude<GuideLocale, "en">;

export const TRANSLATED_GUIDE_LOCALES = ["ru", "es", "zh"] as const;

export function isTranslatedGuideLocale(locale: string): locale is TranslatedGuideLocale {
  return locale === "ru" || locale === "es" || locale === "zh";
}

// Every language page and sitemap entry uses this same reciprocal set.
export const HOW_IT_WORKS_ALTERNATES = {
  en: `${SITE_URL}/how-it-works`,
  ru: `${SITE_URL}/ru/how-it-works`,
  es: `${SITE_URL}/es/how-it-works`,
  "zh-Hans": `${SITE_URL}/zh/how-it-works`,
  "x-default": `${SITE_URL}/how-it-works`,
};
