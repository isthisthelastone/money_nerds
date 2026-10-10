import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslator } from "@/lib/i18n/server";
import { legalLinks } from "@/lib/legal/content";
import { ContactLink, ContactStatus } from "@/components/legal/ContactLink";

export default async function LegalLayout({ children }: { children: ReactNode }) {
  const t = await getTranslator();
  return <main className="site-page site-shell">
    <nav aria-label={t("Legal navigation")} className="mb-8 flex flex-wrap gap-2">
      {legalLinks.map(({ href, label }) => <Link key={href} href={href} className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm hover:border-[#c9ff55] focus-visible:outline-2 focus-visible:outline-[#c9ff55]">{t(label)}</Link>)}
    </nav>
    {children}
    <aside className="site-callout mt-12">
      <div><h2>{t("Contact Money Nerds")}</h2><ContactLink className="break-all text-[#c9ff55] underline underline-offset-4" /><ContactStatus /></div>
      <Link href="/legal/report" className="site-button site-button--primary">{t("Rights and content reports")}</Link>
    </aside>
  </main>;
}
