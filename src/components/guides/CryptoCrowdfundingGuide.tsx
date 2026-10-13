import Link from "next/link";
import { ArrowRight, ChevronRight, Info } from "lucide-react";
import { getCryptoCrowdfundingContent } from "@/lib/crypto-crowdfunding-content";
import { PAYOUT_ASSETS, PAYOUT_ASSET_CONFIG } from "@/lib/funding/payouts";
import type { Locale } from "@/lib/i18n/config";
import { GuideLanguages } from "@/components/site/GuideLanguages";

// Keep the visible asset table aligned with the application's accepted routes.
const networkRows = Array.from(
  PAYOUT_ASSETS.reduce((rows, asset) => {
    const config = PAYOUT_ASSET_CONFIG[asset];
    const row = rows.get(config.caipNetworkId) ?? {
      id: config.caipNetworkId,
      name: config.networkName.replace(/ Mainnet$/, ""),
      assets: [] as string[],
    };
    const standard = config.tokenStandard === "ERC20" ? "ERC-20" : config.tokenStandard === "TRC20" ? "TRC-20" : config.tokenStandard;
    row.assets.push(`${config.symbol}${standard ? ` (${standard})` : ""}`);
    rows.set(row.id, row);
    return rows;
  }, new Map<string, { id: string; name: string; assets: string[] }>()),
  ([, row]) => row,
);

export interface CryptoCrowdfundingGuideProps {
  locale: Locale;
  /** A route owner can supply its canonical localized guide URL strategy. */
  localizeHref?: (path: string) => string;
}

export function CryptoCrowdfundingGuide({ locale, localizeHref }: CryptoCrowdfundingGuideProps) {
  const content = getCryptoCrowdfundingContent(locale);
  const href = localizeHref ?? ((path: string) => {
    if (locale === "en") return path;
    if (path === "/how-it-works") return `/${locale}/how-it-works`;
    const [pathname, fragment] = path.split("#");
    return `${pathname}${pathname.includes("?") ? "&" : "?"}ui=${locale}${fragment ? `#${fragment}` : ""}`;
  });
  const resources = [
    { path: "/how-it-works", label: content.resources.how },
    { path: "/transparency", label: content.resources.transparency },
    { path: "/safety", label: content.resources.safety },
    { path: "/community", label: content.resources.community },
    { path: "/faq", label: content.resources.faq },
    { path: "/legal/terms", label: content.resources.terms },
    { path: "/legal/report", label: content.resources.contact },
  ];

  return (
    <main className="site-page site-shell" lang={locale === "zh" ? "zh-Hans" : locale}>
      <nav aria-label={content.breadcrumbLabel} className="mb-8 flex flex-wrap items-center gap-2 text-sm text-white/55">
        <Link href={href("/")} className="hover:text-[#c9ff55]">Money Nerds</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{content.label}</span>
      </nav>

      <header className="site-page-hero">
        <p className="site-kicker">{content.label}</p>
        <h1>{content.title}</h1>
        <p className="site-page-hero__lede">{content.introduction}</p>
        <div className="site-actions">
          <Link className="site-button site-button--primary" href={href("/#feed")}>{content.browseLabel}<ArrowRight size={17} aria-hidden="true" /></Link>
          <Link className="site-button site-button--secondary" href={href("/how-it-works")}>{content.howLabel}</Link>
        </div>
      </header>

      <GuideLanguages locale={locale} path="/crypto-crowdfunding" />

      <section className="site-section" aria-label={content.factsLabel}>
        <div className="site-bento">
          {content.facts.map((fact) => (
            <article className="site-card" key={fact.title}>
              <h2 className="text-xl font-semibold tracking-tight text-[#f2efe6]">{fact.title}</h2>
              <p>{fact.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-section" aria-labelledby="crowdfunding-uses">
        <h2 className="site-section__heading" id="crowdfunding-uses">{content.usesTitle}</h2>
        <p className="site-section__intro">{content.usesIntroduction}</p>
        <div className="site-bento">
          {content.uses.map((use) => (
            <article className="site-card" key={use.category}>
              <h3><Link className="inline-flex min-h-11 items-center gap-2 hover:text-[#c9ff55]" href={href(`/?category=${use.category}#feed`)}>{use.title}<ArrowRight size={16} aria-hidden="true" /></Link></h3>
              <p>{use.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-section" aria-labelledby="crowdfunding-networks">
        <h2 className="site-section__heading" id="crowdfunding-networks">{content.networksTitle}</h2>
        <p className="site-section__intro" id="crowdfunding-networks-description">{content.networksIntroduction}</p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.025]">
          <table className="w-full table-fixed text-left text-sm leading-6 sm:text-base" aria-describedby="crowdfunding-networks-description">
            <thead className="border-b border-white/12 bg-white/[0.035] text-[#f2efe6]">
              <tr><th className="w-2/5 px-4 py-3 font-semibold sm:px-6" scope="col">{content.networkColumn}</th><th className="px-4 py-3 font-semibold sm:px-6" scope="col">{content.assetsColumn}</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {networkRows.map((network) => (
                <tr key={network.id}>
                  <th className="break-words px-4 py-3 font-medium text-[#f2efe6] sm:px-6" scope="row">{network.name}</th>
                  <td className="px-4 py-3 text-white/70 sm:px-6">{network.assets.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="site-note"><Info aria-hidden="true" size={18} />{content.networkNote}</p>
      </section>

      <section className="site-section" aria-labelledby="crowdfunding-steps">
        <h2 className="site-section__heading" id="crowdfunding-steps">{content.stepsTitle}</h2>
        <ol className="site-steps">
          {content.steps.map((step) => <li key={step.title}><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}
        </ol>
      </section>

      <section className="site-section" aria-labelledby="crowdfunding-boundaries">
        <h2 className="site-section__heading" id="crowdfunding-boundaries">{content.boundariesTitle}</h2>
        {content.boundaries.map((paragraph) => <p className="site-section__intro" key={paragraph}>{paragraph}</p>)}
      </section>

      <section className="site-section" aria-labelledby="crowdfunding-questions">
        <h2 className="site-section__heading" id="crowdfunding-questions">{content.faqTitle}</h2>
        <div className="mt-8 grid gap-4">
          {content.questions.map((question) => <article className="site-card" key={question.title}><h3>{question.title}</h3><p className="max-w-4xl">{question.text}</p></article>)}
        </div>
      </section>

      <section className="site-callout" aria-labelledby="crowdfunding-resources">
        <div>
          <h2 id="crowdfunding-resources">{content.resourcesTitle}</h2>
          <p>{content.resourcesIntroduction}</p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1">
            {resources.map((resource) => <li key={resource.path}><Link className="inline-flex min-h-11 items-center text-sm text-[#c9ff55] underline underline-offset-4" href={href(resource.path)}>{resource.label}</Link></li>)}
          </ul>
        </div>
        <Link className="site-button site-button--primary" href={href("/#feed")}>{content.browseLabel}<ArrowRight size={17} aria-hidden="true" /></Link>
      </section>
    </main>
  );
}
