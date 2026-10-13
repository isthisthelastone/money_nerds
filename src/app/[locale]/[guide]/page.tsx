import { notFound } from "next/navigation";
import AboutPage, { generateMetadata as aboutMetadata } from "@/app/about/page";
import FaqPage, { generateMetadata as faqMetadata } from "@/app/faq/page";
import SafetyPage, { generateMetadata as safetyMetadata } from "@/app/safety/page";
import CommunityPage, { generateMetadata as communityMetadata } from "@/app/community/page";
import TransparencyPage, { generateMetadata as transparencyMetadata } from "@/app/transparency/page";
import CryptoCrowdfundingPage, { generateMetadata as crowdfundingMetadata } from "@/app/crypto-crowdfunding/page";
import { isTranslatedGuideLocale, TRANSLATED_GUIDE_LOCALES } from "@/lib/guide-languages";

const pages = {
  about: { Page: AboutPage, metadata: aboutMetadata },
  faq: { Page: FaqPage, metadata: faqMetadata },
  safety: { Page: SafetyPage, metadata: safetyMetadata },
  community: { Page: CommunityPage, metadata: communityMetadata },
  transparency: { Page: TransparencyPage, metadata: transparencyMetadata },
  "crypto-crowdfunding": { Page: CryptoCrowdfundingPage, metadata: crowdfundingMetadata },
} as const;

type Props = { params: Promise<{ locale: string; guide: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return TRANSLATED_GUIDE_LOCALES.flatMap((locale) => Object.keys(pages).map((guide) => ({ locale, guide })));
}

async function resolve({ params }: Props) {
  const { locale, guide } = await params;
  if (!isTranslatedGuideLocale(locale) || !Object.hasOwn(pages, guide)) notFound();
  return pages[guide as keyof typeof pages];
}

export async function generateMetadata(props: Props) {
  return (await resolve(props)).metadata();
}

export default async function LocalizedEditorialPage(props: Props) {
  const { Page } = await resolve(props);
  return <Page />;
}
