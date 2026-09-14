import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, Info } from "lucide-react";
import { GuideLanguages } from "@/components/site/GuideLanguages";
import { GuideSection } from "@/components/site/GuidePage";
import {
  GUIDE_LANGUAGES,
  HOW_IT_WORKS_ALTERNATES,
  TRANSLATED_GUIDE_LOCALES,
  isTranslatedGuideLocale,
} from "@/lib/guide-languages";
import { HOW_IT_WORKS_TRANSLATIONS } from "@/lib/how-it-works-translations";

type Props = { params: Promise<{ locale: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return TRANSLATED_GUIDE_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isTranslatedGuideLocale(locale)) notFound();

  const copy = HOW_IT_WORKS_TRANSLATIONS[locale];
  const language = GUIDE_LANGUAGES.find((item) => item.locale === locale)!;
  const title = `${copy.label} — Money Nerds`;

  return {
    title: copy.label,
    description: copy.description,
    alternates: { canonical: language.path, languages: HOW_IT_WORKS_ALTERNATES },
    openGraph: {
      type: "website",
      title,
      description: copy.description,
      url: language.path,
      locale: language.openGraphLocale,
      alternateLocale: GUIDE_LANGUAGES.filter((item) => item.locale !== locale).map((item) => item.openGraphLocale),
      images: [{ url: "/og.png", width: 1733, height: 907, alt: "Money Nerds" }],
    },
    twitter: { card: "summary_large_image", title, description: copy.description, images: ["/og.png"] },
  };
}

const linkClass = "text-[#c9ff55] underline underline-offset-4";

export default async function TranslatedHowItWorksPage({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedGuideLocale(locale)) notFound();

  const copy = HOW_IT_WORKS_TRANSLATIONS[locale];
  const language = GUIDE_LANGUAGES.find((item) => item.locale === locale)!;

  return (
    <main className="site-page site-shell" lang={language.language}>
      <nav aria-label={copy.breadcrumbLabel} className="mb-8 flex flex-wrap items-center gap-2 text-sm text-white/55">
        <Link className="hover:text-[#c9ff55]" href="/">Money Nerds</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">{copy.label}</span>
      </nav>
      <header className="site-page-hero">
        <p className="site-kicker">{copy.label}</p>
        <h1>{copy.title}</h1>
        <p className="site-page-hero__lede">{copy.introduction}</p>
      </header>

      <GuideLanguages locale={locale} />

      <GuideSection id="create-an-ask" title={copy.createTitle}>
        <ol className="site-steps">
          {copy.createSteps.map((step) => (
            <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
          <Link className={linkClass} href="/#feed">{copy.links.composer}</Link>
          <Link className={linkClass} href="/?category=build#feed">{copy.links.build}</Link>
          <Link className={linkClass} href="/?category=mutual-aid#feed">{copy.links.mutualAid}</Link>
        </div>
      </GuideSection>

      <GuideSection id="support-a-post" title={copy.supportTitle}>
        <ol className="site-steps">
          {copy.supportSteps.map((step) => (
            <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>
          ))}
        </ol>
        <p className="site-note">
          <Info aria-hidden="true" size={18} />
          {copy.fees}{" "}
          <Link className="underline underline-offset-4" href="/transparency" hrefLang="en">{copy.links.transparency}</Link>
        </p>
      </GuideSection>

      <GuideSection id="supported-networks" title={copy.networksTitle}>
        <p className="site-section__intro">{copy.networksIntroduction}</p>
        <div className="site-bento">
          {copy.networks.map(([network, assets]) => (
            <article className="site-card" key={network}><h3>{network}</h3><p>{assets}</p></article>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="sbp-option" title={copy.sbpTitle}>
        {copy.sbpParagraphs.map((paragraph) => <p className="site-section__intro" key={paragraph}>{paragraph}</p>)}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3">
          <Link className={linkClass} href="/settings">{copy.links.settings}</Link>
          <Link className={linkClass} href="/safety" hrefLang="en">{copy.links.safety}</Link>
        </div>
      </GuideSection>

      <nav aria-label={copy.links.related} className="mt-8 flex flex-wrap gap-x-5 gap-y-3">
        <Link className={linkClass} href="/faq" hrefLang="en">{copy.links.faq}</Link>
        <Link className={linkClass} href="/community" hrefLang="en">{copy.links.community}</Link>
      </nav>

      <section className="site-callout" aria-labelledby="guide-board-title">
        <div>
          <p className="site-kicker">{copy.callout.kicker}</p>
          <h2 id="guide-board-title">{copy.callout.title}</h2>
          <p>{copy.callout.text}</p>
        </div>
        <Link className="site-button site-button--primary" href="/#feed">
          {copy.callout.action} <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </section>
    </main>
  );
}
