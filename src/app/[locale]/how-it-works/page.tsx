import { notFound } from "next/navigation";
import HowItWorksPage, { generateMetadata as guideMetadata } from "@/app/how-it-works/page";
import { isTranslatedGuideLocale, TRANSLATED_GUIDE_LOCALES } from "@/lib/guide-languages";

type Props = { params: Promise<{ locale: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return TRANSLATED_GUIDE_LOCALES.map(locale => ({ locale })); }
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isTranslatedGuideLocale(locale)) notFound();
  const metadata = await guideMetadata();
  return { ...metadata, alternates: { ...metadata.alternates, canonical: `/${locale}/how-it-works` }, openGraph: { ...metadata.openGraph, url: `/${locale}/how-it-works` } };
}
export default async function TranslatedGuidePage({ params }: Props) {
  if (!isTranslatedGuideLocale((await params).locale)) notFound();
  return <HowItWorksPage />;
}
