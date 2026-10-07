import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { legalLinks } from "@/lib/legal/content";

export async function generateMetadata() {
  const t = await getTranslator();
  return { title: t("Legal and privacy"), alternates: { canonical: "/legal" } };
}
export default async function LegalPage() {
  const t = await getTranslator();
  return <>
    <header className="site-page-hero"><h1>{t("Legal and privacy")}</h1><p className="site-page-hero__lede">{t("Understand the public board, your privacy choices and how to report a problem.")}</p></header>
    <p className="mt-8 max-w-3xl text-white/70">{t("These notices describe the service and the controls available. Operator details and several country-specific legal requirements remain unverified; these pages are not a certification of compliance or a guarantee of lawful availability in every country.")}</p>
    <div className="site-bento mt-8">{legalLinks.slice(1).map(({ href, label }) => <Link className="site-card min-h-24 hover:border-[#c9ff55]" key={href} href={href}><h2>{t(label)} →</h2></Link>)}</div>
    <Link href="/settings" className="site-button mt-8">{t("Privacy and country settings")}</Link>
  </>;
}
