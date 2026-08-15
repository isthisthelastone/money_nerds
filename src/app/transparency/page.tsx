import type {Metadata} from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
    title: "Transparency",
    description:
        "See how Money Nerds handles direct donations, network fees, and voluntary support for the service.",
    alternates: {canonical: "/transparency"},
    openGraph: {
        url: "/transparency",
        title: "Money Nerds Transparency",
        description: "Direct settlement, zero platform commission, and a public service wallet.",
    },
};

export default function TransparencyPage() {
    return (
        <main className="site-page site-shell">
            <header className="site-page-hero">
                <p className="site-kicker">Open ledger, plain language</p>
                <h1>Trust should be inspectable.</h1>
                <p className="site-page-hero__lede">
                    Money Nerds is built around a simple rule: user donations go to the person
                    who made the ask. The platform takes no commission and keeps its own support
                    wallet public.
                </p>
            </header>

            <section className="site-section" aria-labelledby="money-flow-title">
                <h2 className="site-section__heading" id="money-flow-title">
                    The money path has no hidden stop.
                </h2>
                <div className="site-bento">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <HandCoins size={22} />
                        </span>
                        <h3>The supporter chooses</h3>
                        <p>
                            A supporter enters an amount and reviews the recipient before any
                            transaction is prepared.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ShieldCheck size={22} />
                        </span>
                        <h3>The wallet approves</h3>
                        <p>
                            The connected wallet displays the transfer and network fee. Nothing
                            moves until its owner signs.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Blocks size={22} />
                        </span>
                        <h3>Solana settles</h3>
                        <p>
                            The transfer goes from supporter to recipient. Its signature can be
                            inspected independently on a block explorer.
                        </p>
                    </article>
                </div>
            </section>

            <section className="site-section" aria-labelledby="service-wallet-title">
                <h2 className="site-section__heading" id="service-wallet-title">
                    Money Nerds runs on voluntary support.
                </h2>
                <p className="site-section__intro">
                    The platform does not take a percentage of user donations. People who want
                    to support hosting and continued development can donate separately to the
                    service wallet below.
                </p>

                <div className="ledger-panel">
                    <span className="ledger-panel__status">Public Solana account</span>
                    <p className="ledger-panel__label">Money Nerds service wallet</p>
                    <code className="ledger-panel__address">{SERVICE_WALLET}</code>
                    <a
                        className="ledger-panel__link"
                        href={SOLSCAN_URL}
                        rel="noreferrer"
                        target="_blank"
                    >
                        Inspect transactions on Solscan
                        <ExternalLink aria-hidden="true" size={15} />
                    </a>
                </div>
            </section>

            <section className="site-section" aria-labelledby="visible-title">
                <h2 className="site-section__heading" id="visible-title">
                    What “transparent” means here.
                </h2>
                <div className="site-bento">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Eye size={22} />
                        </span>
                        <h3>Public wallet identity</h3>
                        <p>
                            Posts and activity can be traced to the wallet that created them,
                            while a nickname can remain informal and change over time.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <CircleDollarSign size={22} />
                        </span>
                        <h3>Direct recipient</h3>
                        <p>
                            The transaction review must clearly identify the wallet receiving the
                            donation before the supporter signs it.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ExternalLink size={22} />
                        </span>
                        <h3>Independent verification</h3>
                        <p>
                            Explorer links expose the underlying transaction rather than asking
                            people to trust a private platform total.
                        </p>
                    </article>
                </div>

                <p className="site-note">
                    <Info aria-hidden="true" size={18} />
                    Public-chain visibility does not prove that every story in a post is true.
                    Supporters should review context, wallet history, and risk before donating.
                </p>
            </section>

            <section className="site-callout" aria-labelledby="browse-title">
                <div>
                    <p className="site-kicker">No mystery math</p>
                    <h2 id="browse-title">Zero platform commission means zero.</h2>
                    <p>
                        The network may charge a small transaction fee. Money Nerds does not add
                        a percentage on top of the amount sent to another user.
                    </p>
                </div>
                <Link className="site-button site-button--primary" href="/">
                    Browse the board <ArrowRight aria-hidden="true" size={17} />
                </Link>
            </section>
        </main>
    );
}
