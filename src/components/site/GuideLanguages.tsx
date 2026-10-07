import Link from "next/link";
import { GUIDE_LANGUAGES, type GuideLocale } from "@/lib/guide-languages";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";

export async function GuideLanguages({ locale }: { locale: GuideLocale }) {
  const t = await getTranslator();
  return <nav aria-label={t("Choose language")} className="mt-8 flex flex-wrap items-center gap-2">
    {GUIDE_LANGUAGES.map(language => <Link key={language.locale} href={language.path} hrefLang={language.language} lang={language.language} aria-current={language.locale === locale ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm ${language.locale === locale ? "border-[#c9ff55]/40 text-[#dfff9c]" : "border-white/15 text-white/65"}`}>
      <span aria-hidden="true">{LANGUAGE_OPTIONS[language.locale].flag}</span><span className="ml-2">{language.label}</span>
    </Link>)}
  </nav>;
}
