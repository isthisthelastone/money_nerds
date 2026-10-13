import { NextRequest } from "next/server";
import { SITE_URL } from "@/lib/config";
import { CATEGORY_SCOPES } from "@/lib/categories";
import { getFeed } from "@/lib/data";
import { parseFeedParams } from "@/lib/feed-params";
import { feedSeo } from "@/lib/feed-seo";
import { getCryptoCrowdfundingContent } from "@/lib/crypto-crowdfunding-content";
import { localizedPublicPath } from "@/lib/editorial";
import { browserLocale, isLocale, LOCALE_COOKIE, makeTranslator } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export const dynamic = "force-dynamic";

/** Quote user text as content, never as headings or rendering instructions. */
function quote(value: string) {
  return value.replace(/\r\n?/g, "\n").split("\n").map((line) => `> ${line.replace(/[<>]/g, (c) => c === "<" ? "&lt;" : "&gt;")}`).join("\n");
}

function label(value: string) {
  return value.replace(/[\\[\]<>\r\n]/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const all = request.nextUrl.searchParams.getAll(key);
    values[key] = all.length > 1 ? all : all[0];
  }
  const params = parseFeedParams(values);
  const seo = feedSeo(values);
  const explicit = request.nextUrl.searchParams.get("ui");
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(explicit) ? explicit : isLocale(cookie) ? cookie : browserLocale(request.headers.get("accept-language")) ?? "en";
  const t = makeTranslator(getMessages(locale));
  const content = getCryptoCrowdfundingContent(locale);
  const canonical = `${SITE_URL}${seo.canonical}`;
  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Language": locale === "zh" ? "zh-Hans" : locale,
    // Match the personalized HTML's cache isolation; only anonymous feed data is read.
    "Cache-Control": "no-store",
    "Vary": "Accept, Accept-Language, Cookie",
    "Link": `<${canonical}>; rel="canonical"`,
    ...(seo.indexable ? {} : { "X-Robots-Tag": "noindex, follow" }),
  };

  try {
    const { posts, count } = await getFeed(params);
    const totalPages = Math.max(1, Math.ceil(count / params.pageSize));
    if (params.page > totalPages) {
      const next = new URL(request.url);
      next.pathname = "/";
      if (totalPages === 1) next.searchParams.delete("page");
      else next.searchParams.set("page", String(totalPages));
      return new Response(null, { status: 307, headers: { ...headers, Location: `${SITE_URL}${next.pathname}${next.search}` } });
    }

    const postText = posts.map((post) => {
      const lines = [
        `### [${label(post.nickname)} — ${post.id}](${SITE_URL}/p/${post.id})`,
        `${post.created_at} · [${label(post.nickname)}](${SITE_URL}/u/${encodeURIComponent(post.author_wallet)})`,
        quote(post.body),
        ...post.media.map((media) => `[${label(media.alt_text || media.kind)}](${SITE_URL}/media/${encodeURIComponent(media.id)})`),
      ];
      return lines.filter(Boolean).join("\n\n");
    }).join("\n\n");
    const pagingLink = (page: number) => {
      const next = new URL(request.url);
      next.pathname = "/";
      if (page === 1) next.searchParams.delete("page");
      else next.searchParams.set("page", String(page));
      return `${SITE_URL}${next.pathname}${next.search}`;
    };
    const guideLink = (path: string) => `${SITE_URL}${localizedPublicPath(path, locale)}`;
    const markdown = [
      "# Money Nerds",
      content.introduction,
      ...content.facts.map((fact) => `- **${fact.title}:** ${fact.text}`),
      `[${content.label}](${guideLink("/crypto-crowdfunding")}) · [${content.howLabel}](${guideLink("/how-it-works")})`,
      `## ${t("Category")}`,
      CATEGORY_SCOPES.map((category) => `- [${t(category.label)}](${SITE_URL}/?category=${category.value}): ${t(category.shortDescription)}`).join("\n"),
      `## ${seo.scope ? t(seo.scope.label) : t("The public board")}`,
      t("Page {page} of {pages} · {count} posts", { page: params.page, pages: totalPages, count }),
      postText || t("Nothing in this corner yet."),
      [params.page > 1 ? `[${t("Previous")}](${pagingLink(params.page - 1)})` : "", params.page < totalPages ? `[${t("Next")}](${pagingLink(params.page + 1)})` : ""].filter(Boolean).join(" · "),
      `## ${content.boundariesTitle}`,
      ...content.boundaries,
      `[${content.resources.safety}](${guideLink("/safety")}) · [${content.resources.transparency}](${guideLink("/transparency")}) · [${content.resources.contact}](${SITE_URL}/legal/report)`,
    ].filter(Boolean).join("\n\n");

    return new Response(`${markdown}\n`, { headers });
  } catch {
    return new Response(`# Money Nerds\n\nThe public board is temporarily unavailable. Please retry shortly.\n\n[How it works](${SITE_URL}/how-it-works) · [Sitemap](${SITE_URL}/sitemap.xml)\n`, {
      status: 503,
      headers: { ...headers, "Retry-After": "30" },
    });
  }
}
