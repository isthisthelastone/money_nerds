import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestPreferences, getTranslator } from "@/lib/i18n/server";
import { LEGAL_UPDATED, legalDocuments, type LegalDocumentKey } from "@/lib/legal/content";
import { MalaysiaNotice } from "../MalaysiaNotice";

type Props = { params: Promise<{ document: string }> };
function documentFor(key: string) {
  return Object.hasOwn(legalDocuments, key) ? legalDocuments[key as LegalDocumentKey] : null;
}
export async function generateMetadata({ params }: Props) {
  const { document } = await params;
  const data = documentFor(document);
  if (!data) return {};
  return { title: (await getTranslator())(data.title), alternates: { canonical: `/legal/${document}` } };
}
export default async function LegalDocumentPage({ params }: Props) {
  const { document } = await params;
  const data = documentFor(document);
  if (!data) notFound();
  const [t, { locale }] = await Promise.all([getTranslator(), getRequestPreferences()]);
  return <>
    <header className="site-page-hero"><h1>{t(data.title)}</h1><p className="mt-4 text-sm text-white/55">{t("Updated {date}", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(LEGAL_UPDATED)) })}</p></header>
    {data.sections.map(([title, body], index) => <section className="site-section max-w-3xl" aria-labelledby={`legal-${index}`} key={title}><h2 id={`legal-${index}`} className="site-section__heading">{t(title)}</h2><p className="site-section__intro">{t(body)}</p></section>)}
    <div className="mt-8 flex flex-wrap gap-4"><Link href="/settings" className="site-button">{t("Privacy and country settings")}</Link><Link href="/legal/regions" className="site-button">{t("Country notices")}</Link></div>
    {document === "privacy" && <MalaysiaNotice />}
  </>;
}
