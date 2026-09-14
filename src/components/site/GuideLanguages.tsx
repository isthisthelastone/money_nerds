import Link from "next/link";
import { GUIDE_LANGUAGES, type GuideLocale } from "@/lib/guide-languages";

const copy = {
  en: { label: "Guide language", note: "These are translations of this guide. The app and other guides may be in English." },
  ru: { label: "Язык руководства", note: "Переведено только это руководство. Интерфейс приложения и другие руководства могут быть на английском." },
  es: { label: "Idioma de la guía", note: "Estas son traducciones de esta guía. La aplicación y las demás guías pueden estar en inglés." },
  zh: { label: "指南语言", note: "仅本指南提供这些翻译。应用界面及其他指南可能仍为英文。" },
} satisfies Record<GuideLocale, { label: string; note: string }>;

export function GuideLanguages({ locale }: { locale: GuideLocale }) {
  return (
    <div className="mt-8">
      <nav aria-label={copy[locale].label} className="flex flex-wrap items-center gap-2">
        {GUIDE_LANGUAGES.map((language) => (
          <Link
            key={language.locale}
            href={language.path}
            hrefLang={language.language}
            lang={language.language}
            aria-current={language.locale === locale ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm transition ${
              language.locale === locale
                ? "border-[#c9ff55]/40 bg-[#c9ff55]/10 text-[#dfff9c]"
                : "border-white/15 text-white/65 hover:border-white/35 hover:text-white"
            }`}
          >
            {language.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-sm leading-relaxed text-white/55">{copy[locale].note}</p>
    </div>
  );
}
