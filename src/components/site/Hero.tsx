import { getTranslator } from "@/lib/i18n/server";
import Link from "next/link";
import {ArrowDown, ArrowRight, Blocks, CircleDollarSign, ShieldCheck} from "lucide-react";
import {HeroCoin} from "./HeroCoin";

export async function Hero() {
  const t = await getTranslator();
    return (
        <section className="site-hero site-shell" aria-labelledby="money-nerds-title">
            <div className="site-hero__copy">
                <p className="site-kicker">{t("Direct generosity across networks")}</p>
                <h1 id="money-nerds-title"> {t("Ask. Share.")} <em>{t("Get funded.")}</em>
                </h1>
                <p className="site-hero__lede"> {t("Post a meme, fund a real need, or back an idea. Money Nerds is a crypto imageboard and crowdfunding community where support moves directly between people.")} </p>

                <div className="site-actions">
                    <a className="site-button site-button--primary" href="#feed"> {t("Explore requests")} <ArrowDown aria-hidden="true" size={17} />
                    </a>
                    <Link className="site-button site-button--secondary" href="/how-it-works"> {t("How it works")} <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                </div>

                <ul className="site-trust-row" aria-label={t("Platform principles")}>
                    <li>
                        <CircleDollarSign aria-hidden="true" size={14} /> {t("0% platform fee")} </li>
                    <li>
                        <Blocks aria-hidden="true" size={14} /> {t("Public on-chain")} </li>
                    <li>
                        <ShieldCheck aria-hidden="true" size={14} /> {t("You approve every transfer")} </li>
                </ul>
            </div>

            <HeroCoin />
        </section>
    );
}
