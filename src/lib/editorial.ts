import type { Metadata } from "next";
import { SITE_URL } from "@/lib/config";
import { isLocale, LOCALES, type Locale } from "@/lib/i18n/config";

export const EDITORIAL_SLUGS = ["how-it-works", "about", "faq", "safety", "community", "transparency", "crypto-crowdfunding"] as const;
export type EditorialSlug = (typeof EDITORIAL_SLUGS)[number];
export type EditorialPath = `/${EditorialSlug}`;

export const EDITORIAL_LANGUAGES: Record<Locale, { language: string; openGraphLocale: string }> = {
  en: { language: "en", openGraphLocale: "en_GB" },
  es: { language: "es", openGraphLocale: "es_ES" },
  zh: { language: "zh-Hans", openGraphLocale: "zh_CN" },
  ru: { language: "ru", openGraphLocale: "ru_RU" },
  vi: { language: "vi", openGraphLocale: "vi_VN" },
};

export function isEditorialSlug(value: string): value is EditorialSlug {
  return EDITORIAL_SLUGS.some((slug) => slug === value);
}

/** Only the editorial route family has language prefixes; user content keeps its URLs. */
export function editorialRoute(path: string): { path: EditorialPath; locale: Locale; hasLocalePrefix: boolean } | null {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/$/, "");
  const match = pathname.match(/^\/(?:(en|es|zh|ru|vi)\/)?([^/]+)$/);
  if (!match || !isEditorialSlug(match[2])) return null;
  return { path: `/${match[2]}`, locale: isLocale(match[1]) ? match[1] : "en", hasLocalePrefix: Boolean(match[1]) };
}

export function localizedPublicPath(path: string, locale: Locale): string {
  const route = editorialRoute(path);
  if (!route) return path;
  const suffixAt = path.search(/[?#]/);
  const suffix = suffixAt < 0 ? "" : path.slice(suffixAt);
  return `${locale === "en" ? "" : `/${locale}`}${route.path}${suffix}`;
}

export function editorialAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((locale) => [EDITORIAL_LANGUAGES[locale].language, `${SITE_URL}${localizedPublicPath(path, locale)}`])),
    "x-default": `${SITE_URL}${localizedPublicPath(path, "en")}`,
  };
}

/** Apply URL identity after translating the page's human-readable metadata. */
export function editorialMetadata(metadata: Metadata, path: string, locale: Locale): Metadata {
  const canonical = localizedPublicPath(path, locale);
  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical, languages: editorialAlternates(path) },
    openGraph: {
      ...metadata.openGraph,
      url: canonical,
      locale: EDITORIAL_LANGUAGES[locale].openGraphLocale,
      alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => EDITORIAL_LANGUAGES[other].openGraphLocale),
    },
    twitter: {
      card: "summary_large_image",
      ...metadata.twitter,
      title: metadata.twitter?.title ?? metadata.openGraph?.title ?? metadata.title ?? undefined,
      description: metadata.twitter?.description ?? metadata.description ?? undefined,
    },
  };
}
