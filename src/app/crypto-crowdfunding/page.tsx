import type { Metadata } from "next";
import { CryptoCrowdfundingGuide } from "@/components/guides/CryptoCrowdfundingGuide";
import { getCryptoCrowdfundingContent } from "@/lib/crypto-crowdfunding-content";
import { editorialMetadata, localizedPublicPath } from "@/lib/editorial";
import { getRequestPreferences } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/config";
import { SOCIAL_PREVIEW_IMAGE } from "@/lib/social-preview";
import { serializeJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestPreferences();
  const content = getCryptoCrowdfundingContent(locale);
  return editorialMetadata({
    title: content.metadataTitle,
    description: content.metadataDescription,
    openGraph: {
      type: "website",
      title: content.metadataTitle,
      description: content.metadataDescription,
      images: [SOCIAL_PREVIEW_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metadataTitle,
      description: content.metadataDescription,
      images: [SOCIAL_PREVIEW_IMAGE],
    },
  }, "/crypto-crowdfunding", locale);
}

export default async function CryptoCrowdfundingPage() {
  const { locale } = await getRequestPreferences();
  const content = getCryptoCrowdfundingContent(locale);
  const url = `${SITE_URL}${localizedPublicPath("/crypto-crowdfunding", locale)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: content.title,
        description: content.metadataDescription,
        inLanguage: locale === "zh" ? "zh-Hans" : locale,
        about: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Money Nerds", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: content.label, item: url },
        ],
      },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    <CryptoCrowdfundingGuide locale={locale} localizeHref={(path) => localizedPublicPath(path, locale)} />
  </>;
}
