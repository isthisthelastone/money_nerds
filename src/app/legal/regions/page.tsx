import Link from "next/link";
import { EU_COUNTRIES, LEGAL_COUNTRIES, isLegalCountry } from "@/lib/i18n/config";
import { getRequestPreferences, getTranslator } from "@/lib/i18n/server";
import { countryName, privacyAuthorities, regionalNotices } from "@/lib/legal/countries";

export async function generateMetadata() {
  return { title: (await getTranslator())("Country notices"), alternates: { canonical: "/legal/regions" } };
}
export default async function RegionsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const [query, preferences, t] = await Promise.all([searchParams, getRequestPreferences(), getTranslator()]);
  const country = isLegalCountry(query.country) ? query.country : preferences.country;
  const isEU = (EU_COUNTRIES as readonly string[]).includes(country);
  const authority = privacyAuthorities[country];
  const name = country === "GLOBAL" ? t("Global / not selected") : countryName(country, preferences.locale);
  return <>
    <header className="site-page-hero"><h1>{t("Country notices")}</h1><p className="site-page-hero__lede">{t("Language and country are separate choices. Read any notice without changing your interface language.")}</p></header>
    <form action="/legal/regions" method="get" className="mt-8 flex max-w-xl flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 flex-col gap-2" htmlFor="legal-country">{t("Country for this notice")}<select key={country} id="legal-country" name="country" defaultValue={country} className="min-h-12 rounded-xl border border-white/25 bg-[#111419] px-3 text-white">{LEGAL_COUNTRIES.map((code) => <option value={code} key={code}>{code === "GLOBAL" ? t("Global / not selected") : countryName(code, preferences.locale)}</option>)}</select></label>
      <button type="submit" className="site-button site-button--primary">{t("Read notice")}</button>
    </form>
    <p className="mt-4 text-sm text-white/60">{t("This selection only changes the notice being read. Save your country separately in settings.")}</p>
    <section className="site-section max-w-3xl" aria-labelledby="country-notice"><h2 id="country-notice" className="site-section__heading">{name}</h2><p className="site-section__intro">{t(regionalNotices[isEU ? "EU" : country as keyof typeof regionalNotices])}</p>
      {authority && <p className="mt-6"><span>{t("Regulator or complaint resource")}: </span><a className="text-[#c9ff55] underline underline-offset-4" href={authority.url}>{authority.name}</a></p>}
      {isEU && <p className="mt-4 flex flex-wrap gap-4"><a className="text-[#c9ff55] underline" href="https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng">GDPR</a><a className="text-[#c9ff55] underline" href="https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng">{t("Digital Services Act")}</a><a className="text-[#c9ff55] underline" href="https://www.edpb.europa.eu/about-edpb/our-members_en">EDPB</a></p>}
      {country === "US" && <p className="mt-4"><a className="text-[#c9ff55] underline" href="https://takeitdown.ftc.gov/">{t("Report a platform's failure to remove intimate imagery to the FTC")}</a></p>}
      {country === "MY" && <p className="mt-4"><Link className="text-[#c9ff55] underline" href="/legal/privacy#malaysia-notice">Notis privasi — Bahasa Malaysia / English</Link></p>}
    </section>
    <Link className="site-button" href="/settings">{t("Privacy and country settings")}</Link>
  </>;
}
