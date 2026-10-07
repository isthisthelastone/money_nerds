import { getTranslator } from "@/lib/i18n/server";
import type {Metadata} from "next";
import Link from "next/link";
import { SOCIAL_PREVIEW_IMAGE } from "@/lib/social-preview";
import {
    ArrowRight,
    Blocks,
    CircleDollarSign,
    ExternalLink,
    Eye,
    HandCoins,
    Info,
    ShieldCheck,
} from "lucide-react";

const SERVICE_WALLET = "BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg";
const SOLSCAN_URL = `https://solscan.io/account/${SERVICE_WALLET}`;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
    title: t("Transparency"),
    description: t("See how Money Nerds handles direct donations, network fees, and voluntary support for the service."),
    alternates: {canonical: "/transparency"},
    openGraph: {
        url: "/transparency",
        title: t("Money Nerds Transparency"),
        description: t("Direct settlement, zero platform commission, and a public service wallet."),
        images: [SOCIAL_PREVIEW_IMAGE],
    },
};
}

export default async function TransparencyPage() {
  const t = await getTranslator();
    return (
        <main className="site-page site-shell">
            <header className="site-page-hero">
                <p className="site-kicker">{t("Open ledger, plain language")}</p>
                <h1>{t("Trust should be inspectable.")}</h1>
                <p className="site-page-hero__lede"> {t("Money Nerds is built around a simple rule: user donations go directly to a destination published by the person who made the ask. The platform takes no commission and keeps its own support wallet public.")} </p>
            </header>

            <section className="site-section" aria-labelledby="money-flow-title">
                <h2 className="site-section__heading" id="money-flow-title"> {t("The money path has no hidden stop.")} </h2>
                <div className="site-bento">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <HandCoins size={22} />
                        </span>
                        <h3>{t("The supporter chooses")}</h3>
                        <p> {t("A supporter selects an accepted asset, enters an amount, and reviews the network and recipient address before sending.")} </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ShieldCheck size={22} />
                        </span>
                        <h3>{t("The supporter approves")}</h3>
                        <p> {t("A compatible wallet or sending app displays the transfer and network fee. Nothing moves until its owner approves it.")} </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Blocks size={22} />
                        </span>
                        <h3>{t("The network settles")}</h3>
                        <p> {t("The transfer goes from supporter to recipient. Its signature can be inspected independently on the relevant block explorer.")} </p>
                    </article>
                </div>
                <p className="site-note">
                    <CircleDollarSign aria-hidden="true" size={18} /> {t("Supported routes include SOL, USDC, and USDT on Solana; ETH and USDT on Ethereum; BTC; TRX and USDT on TRON; TON; and INJ.")} </p>
            </section>

            <section className="site-section" aria-labelledby="service-wallet-title">
                <h2 className="site-section__heading" id="service-wallet-title"> {t("Money Nerds runs on voluntary support.")} </h2>
                <p className="site-section__intro"> {t("The platform does not take a percentage of user donations. People who want to support hosting and continued development can donate separately to the service wallet below.")} </p>

                <div className="ledger-panel">
                    <span className="ledger-panel__status">{t("Public Solana account")}</span>
                    <p className="ledger-panel__label">{t("Money Nerds service wallet")}</p>
                    <code className="ledger-panel__address">{SERVICE_WALLET}</code>
                    <a
                        className="ledger-panel__link"
                        href={SOLSCAN_URL}
                        rel="noreferrer"
                        target="_blank"
                    > {t("Inspect transactions on Solscan")} <ExternalLink aria-hidden="true" size={15} />
                    </a>
                </div>
            </section>

            <section className="site-section" aria-labelledby="visible-title">
                <h2 className="site-section__heading" id="visible-title"> {t("What “transparent” means here.")} </h2>
                <div className="site-bento">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Eye size={22} />
                        </span>
                        <h3>{t("Public profile identity")}</h3>
                        <p> {t("Posts, comments, and linked funding activity stay attached to a stable public profile, while its nickname can change over time.")} </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <CircleDollarSign size={22} />
                        </span>
                        <h3>{t("Direct recipient")}</h3>
                        <p> {t("The transaction review must clearly identify the destination address receiving the donation before the supporter approves it.")} </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ExternalLink size={22} />
                        </span>
                        <h3>{t("Independent verification")}</h3>
                        <p> {t("Explorer links expose the underlying transaction rather than asking people to trust a private platform total.")} </p>
                    </article>
                </div>

                <p className="site-note">
                    <Info aria-hidden="true" size={18} /> {t("Public blockchain visibility does not prove that every story in a post is true. Supporters should review context, profile and funding history, and risk before donating.")} </p>
            </section>

            <section className="site-callout" aria-labelledby="browse-title">
                <div>
                    <p className="site-kicker">{t("No mystery math")}</p>
                    <h2 id="browse-title">{t("Zero platform commission means zero.")}</h2>
                    <p> {t("The network may charge a small transaction fee. Money Nerds does not add a percentage on top of the amount sent to another user.")} </p>
                </div>
                <Link className="site-button site-button--primary" href="/"> {t("Browse the board")} <ArrowRight aria-hidden="true" size={17} />
                </Link>
            </section>
        </main>
    );
}
