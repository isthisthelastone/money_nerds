import Link from "next/link";
import { ArrowRight, ArrowRightLeft, CircleDollarSign, Info, ScanSearch } from "lucide-react";
import { localizedPublicPath } from "@/lib/editorial";
import { getRequestPreferences, getTranslator } from "@/lib/i18n/server";

export async function HomeIntroduction() {
  const [t, { locale }] = await Promise.all([getTranslator(), getRequestPreferences()]);

  return (
    <section className="site-shell pb-12 sm:pb-16" aria-labelledby="home-purpose-title">
      <div className="grid items-end gap-5 md:grid-cols-2">
        <div>
          <p className="site-kicker">{t("Why Money Nerds exists")}</p>
          <h2 className="site-section__heading" id="home-purpose-title">
            {t("One board for unserious joy and serious needs.")}
          </h2>
        </div>
        <p className="max-w-xl text-base leading-7 text-white/60">
          {t("A public board where internet culture and direct generosity meet. Support goes straight to the recipient without a platform cut.")}
        </p>
      </div>

      <div className="site-bento">
        <article className="site-card">
          <span className="site-card__icon" aria-hidden="true">
            <ArrowRightLeft size={22} />
          </span>
          <h3>{t("Direct support")}</h3>
          <p>
            {t("Supporters send the selected asset straight to the recipient’s published address. Money Nerds does not custody user funds.")}
          </p>
        </article>
        <article className="site-card">
          <span className="site-card__icon" aria-hidden="true">
            <CircleDollarSign size={22} />
          </span>
          <h3>{t("0% platform fee")}</h3>
          <p>
            {t("No popularity gate, no percentage skimmed from a donation, and no hidden platform balance standing between a supporter and a recipient.")}
          </p>
        </article>
        <article className="site-card">
          <span className="site-card__icon" aria-hidden="true">
            <ScanSearch size={22} />
          </span>
          <h3>{t("Public accountability")}</h3>
          <p>
            {t("Public profiles connect posts, comments, and funding activity, while verified transaction identifiers can be inspected on-chain.")}
          </p>
        </article>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="site-note">
          <Info aria-hidden="true" size={18} />
          {t("Zero platform commission · Network or bank fees may apply")}
        </p>
        <Link className="site-button site-button--secondary" href={localizedPublicPath("/how-it-works", locale)}>
          {t("How it works")} <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </section>
  );
}
