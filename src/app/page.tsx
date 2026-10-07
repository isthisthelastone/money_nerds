import { getTranslator, getRequestPreferences } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ExternalLink, Radio, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Composer } from "@/components/features/Composer";
import { DonateButton } from "@/components/features/DonateButton";
import { PostCard } from "@/components/features/PostCard";
import { Hero } from "@/components/site";
import { CATEGORY_SCOPES, categoryScope } from "@/lib/categories";
import { SERVICE_WALLET, SITE_URL } from "@/lib/config";
import { getFeed, getSiteStats } from "@/lib/data";
import { formatSol } from "@/lib/format";
import {
  DEFAULT_FEED_PAGE_SIZE,
  FEED_PAGE_SIZES,
  isCategory,
  isPostLanguage,
  POST_LANGUAGES,
  POST_LANGUAGE_LABELS,
  type FeedParams,
} from "@/lib/models";
import { serializeJsonLd } from "@/lib/seo";
import { SOCIAL_PREVIEW_IMAGE } from "@/lib/social-preview";

export const revalidate = 60;

const SORTS = ["latest", "loved", "funded"] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const t = await getTranslator();
  const values = await searchParams;
  const requestedCategory = first(values.category);
  const scope = categoryScope(requestedCategory);
  const categoryOnly = Boolean(scope) && Object.entries(values).every(
    ([key, value]) => key === "category" || value === undefined,
  );
  const bareHome = Object.values(values).every((value) => value === undefined);
  const canonical = scope ? `/?category=${scope.value}` : "/";

  return {
    ...(scope
      ? {
          title: t("{category} posts — direct multi-currency support", { category: t(scope.label) }),
          description: `${t(scope.shortDescription)} ${t("Explore public requests and support people directly across supported crypto networks with zero platform commission.")}`,
          openGraph: {
            title: t("{category} posts on Money Nerds", { category: t(scope.label) }),
            description: t(scope.shortDescription),
            url: `${SITE_URL}/?category=${scope.value}`,
            images: [SOCIAL_PREVIEW_IMAGE],
          },
        }
      : {}),
    alternates: {
      canonical,
      types: {
        "application/rss+xml": `${SITE_URL}/feed.xml`,
      },
    },
    robots: bareHome || categoryOnly
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : {
          index: false,
          follow: true,
          googleBot: { index: false, follow: true },
        },
  };
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFeedParams(values: Awaited<SearchParams>): FeedParams {
  const requestedPage = Number(first(values.page));
  const requestedSize = Number(first(values.size));
  const requestedSort = first(values.sort);
  const requestedCategory = first(values.category);
  const requestedLanguage = first(values.language);
  return {
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    pageSize: FEED_PAGE_SIZES.includes(requestedSize as (typeof FEED_PAGE_SIZES)[number])
      ? requestedSize
      : DEFAULT_FEED_PAGE_SIZE,
    sort: SORTS.includes(requestedSort as (typeof SORTS)[number])
      ? (requestedSort as FeedParams["sort"])
      : "latest",
    category: isCategory(requestedCategory) ? requestedCategory : "anything",
    language: isPostLanguage(requestedLanguage) || requestedLanguage === "untagged"
      ? requestedLanguage
      : "all",
  };
}

function pageHref(params: FeedParams, page: number) {
  const search = new URLSearchParams();
  if (page > 1) search.set("page", String(page));
  if (params.pageSize !== DEFAULT_FEED_PAGE_SIZE) search.set("size", String(params.pageSize));
  if (params.sort !== "latest") search.set("sort", params.sort);
  if (params.category !== "anything") search.set("category", params.category);
  if (params.language !== "all") search.set("language", params.language);
  const query = search.toString();
  return query ? `/?${query}#feed` : "/#feed";
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslator();
  const { locale } = await getRequestPreferences();
  const params = parseFeedParams(await searchParams);
  const scope = categoryScope(params.category);
  const [{ posts, count }, stats] = await Promise.all([getFeed(params), getSiteStats()]);
  const totalPages = Math.max(1, Math.ceil(count / params.pageSize));
  if (params.page > totalPages) redirect(pageHref(params, totalPages));

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Money Nerds",
    alternateName: "MoneyNerds",
    url: "https://www.moneynerds.online",
    description: "A public board for direct, zero-commission support across multiple crypto networks.",
  };
  const jsonLd = scope
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "CollectionPage",
            name: t("{category} posts on Money Nerds", { category: t(scope.label) }),
            url: `${SITE_URL}/?category=${scope.value}`,
            description: t(scope.shortDescription),
            isPartOf: { "@type": "WebSite", name: "Money Nerds", url: SITE_URL },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Money Nerds", item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: t(scope.label),
                item: `${SITE_URL}/?category=${scope.value}`,
              },
            ],
          },
        ],
      }
    : websiteJsonLd;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      {scope ? null : <Hero />}
      <section
        className={`site-shell pb-20 ${scope ? "pt-8 sm:pt-12" : ""}`}
        id="feed"
        aria-labelledby="feed-heading"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {scope ? (
              <div className="mb-6 rounded-[1.4rem] border border-[#c9ff55]/20 bg-[#c9ff55]/[0.055] p-5 sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
                  {t("Explore /")}{" "}{t(scope.label)}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f2efe6] sm:text-4xl">
                  {t(scope.label)}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
                  {t(scope.shortDescription)}
                </p>
              </div>
            ) : null}
            <Composer browsingCategory={params.category} />
            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
                  {scope ? t("Category / {value0}", {value0: t(scope.label)}) : t("The public board")}
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#f2efe6]" id="feed-heading">
                  {scope ? t("{value0} posts from public profiles", {value0: t(scope.label)}) : t("Requests from public profiles")}
                </h2>
              </div>
              <form className="flex flex-wrap gap-2" action="/#feed" method="get">
                <label className="grid gap-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                  {t("Sort")}<select name="sort" defaultValue={params.sort} className="feed-select">
                    <option value="latest">{t("Latest")}</option>
                    <option value="loved">{t("Most loved")}</option>
                    <option value="funded">{t("Most funded")}</option>
                  </select>
                </label>
                <label className="grid gap-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                  {t("Category")}<select name="category" defaultValue={params.category} className="feed-select" key={params.category}>
                    <option value="anything">{t("All")}</option>
                    {CATEGORY_SCOPES.map((category) => (
                      <option value={category.value} key={category.value}>{t(category.label)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                  {t("Post language")}<select name="language" defaultValue={params.language} className="feed-select" key={params.language}>
                    <option value="all">{t("All languages")}</option>
                    {POST_LANGUAGES.map((language) => (
                      <option value={language} key={language}>{POST_LANGUAGE_LABELS[language]}</option>
                    ))}
                    <option value="untagged">{t("Not specified")}</option>
                  </select>
                </label>
                <label className="grid gap-1 text-[0.65rem] uppercase tracking-[0.12em] text-white/40">
                  {t("Per page")}<select name="size" defaultValue={String(params.pageSize)} className="feed-select">
                    {FEED_PAGE_SIZES.map((size) => (
                      <option value={size} key={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <button className="button button-secondary self-end" type="submit">{t("Apply")}</button>
              </form>
            </div>

            <div className="mt-5 grid gap-5">
              {posts.map((post) => <PostCard key={post.id} post={post} />)}
              {!posts.length ? (
                <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.02] px-5 py-16 text-center">
                  <p className="text-lg font-medium text-[#f2efe6]">{t("Nothing in this corner yet.")}</p>
                  <p className="mt-2 text-sm text-white/45">{t("Change the filters or make the first ask.")}</p>
                </div>
              ) : null}
            </div>

            <nav className="mt-7 flex items-center justify-between gap-4" aria-label={t("Feed pages")}>
              {params.page > 1 ? (
                <Link className="button button-secondary" href={pageHref(params, params.page - 1)}>
                  <ArrowLeft aria-hidden="true" size={16} /> {t("Previous")}</Link>
              ) : <span />}
              <span className="text-xs text-white/45">{t("Page {page} of {pages} · {count} posts", { page: params.page, pages: totalPages, count })}</span>
              {params.page < totalPages ? (
                <Link className="button button-secondary" href={pageHref(params, params.page + 1)}>
                  {t("Next")}{" "}<ArrowRight aria-hidden="true" size={16} />
                </Link>
              ) : <span />}
            </nav>
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-24" aria-label={t("Platform transparency")}>
            <div className="rounded-[1.4rem] border border-[#c9ff55]/20 bg-[#c9ff55]/[0.055] p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#c9ff55]">
                <Radio aria-hidden="true" size={14} /> {t("Open ledger")}</p>
              <h2 className="mt-3 text-xl font-semibold text-[#f2efe6]">{t("The platform lives on voluntary support.")}</h2>
              <p className="mt-2 text-sm leading-6 text-white/55">{t("We never skim user-to-user funding. Service funding routes and verified transfers stay public.")}</p>
              <div className="mt-5">
                <DonateButton recipientAddress={SERVICE_WALLET} targetType="service" label={t("Support Money Nerds")} />
              </div>
              <a className="mt-4 flex items-center gap-1.5 break-all font-mono text-[0.7rem] text-[#9ccaff] hover:underline" href={`https://solscan.io/account/${SERVICE_WALLET}`} target="_blank" rel="noreferrer">
                {SERVICE_WALLET.slice(0, 12)}…{SERVICE_WALLET.slice(-8)} <ExternalLink aria-hidden="true" size={12} />
              </a>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{t("Public pulse")}</p>
              <dl className="mt-4 grid gap-4">
                <div className="flex items-end justify-between gap-3 border-b border-white/8 pb-3">
                  <dt className="text-sm text-white/50">{t("Posts")}</dt><dd className="text-2xl font-semibold text-[#f2efe6]">{new Intl.NumberFormat(locale).format(stats.posts)}</dd>
                </div>
                <div className="flex items-end justify-between gap-3 border-b border-white/8 pb-3">
                  <dt className="flex items-center gap-1.5 text-sm text-white/50"><Users aria-hidden="true" size={14} /> {t("Profiles")}</dt><dd className="text-2xl font-semibold text-[#f2efe6]">{new Intl.NumberFormat(locale).format(stats.profiles)}</dd>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <dt className="text-sm text-white/50">{t("Verified SOL flow")}</dt><dd className="text-xl font-semibold text-[#c9ff55]">{formatSol(stats.verifiedLamports, locale)} SOL</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5 text-sm leading-6 text-white/50">
              <strong className="block text-[#f2efe6]">{t("Safety note")}</strong>
              {t("Money Nerds links activity to authenticated profiles and verifies supported transfer records—not the truth of every request. Fund thoughtfully.")}<Link className="mt-3 block text-[#9ccaff] hover:underline" href="/safety">{t("Read the safety guide")}</Link>
              <Link className="mt-2 block text-[#9ccaff] hover:underline" href="/how-it-works">{t("New here? How Money Nerds works")}</Link>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
