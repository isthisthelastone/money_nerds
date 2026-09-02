import type {Metadata} from "next";
import Link from "next/link";
import {
    ArrowRight,
    ArrowRightLeft,
    HeartHandshake,
    Info,
    ScanSearch,
    Sparkles,
    Unlock,
} from "lucide-react";

export const metadata: Metadata = {
    title: "About",
    description:
        "Why Money Nerds exists, how direct multi-network support works, and what zero platform commission means.",
    alternates: {canonical: "/about"},
    openGraph: {
        url: "/about",
        title: "About Money Nerds",
        description: "Internet-native expression meets direct, transparent generosity.",
    },
};

export default function AboutPage() {
    return (
        <main className="site-page site-shell">
            <header className="site-page-hero">
                <p className="site-kicker">Why Money Nerds exists</p>
                <h1>Money should move at internet speed.</h1>
                <p className="site-page-hero__lede">
                    The internet made expression global. Money Nerds applies the same idea to
                    support: make an ask, share it publicly, and let another person fund it
                    directly to a destination you publish.
                </p>
            </header>

            <section className="site-section" aria-labelledby="principles-title">
                <h2 className="site-section__heading" id="principles-title">
                    Open by design. Legible by default.
                </h2>
                <p className="site-section__intro">
                    No popularity gate, no percentage skimmed from a donation, and no hidden
                    platform balance standing between a supporter and a recipient.
                </p>
                <div className="site-bento">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Unlock size={22} />
                        </span>
                        <h3>Permissionless voice</h3>
                        <p>
                            A stable public profile anchors each person’s activity. Sign in through
                            an enabled social, Telegram, or Web3 option without creating another
                            site-specific password.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ArrowRightLeft size={22} />
                        </span>
                        <h3>Direct support</h3>
                        <p>
                            Supporters send the selected asset straight to the recipient’s
                            published address. Money Nerds does not custody user funds.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <ScanSearch size={22} />
                        </span>
                        <h3>Public accountability</h3>
                        <p>
                            Public profiles connect posts, comments, and funding activity, while
                            verified transaction identifiers can be inspected on-chain.
                        </p>
                    </article>
                </div>
            </section>

            <section className="site-section" aria-labelledby="one-board-title">
                <h2 className="site-section__heading" id="one-board-title">
                    One board for unserious joy and serious needs.
                </h2>
                <div className="site-duo">
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <Sparkles size={22} />
                        </span>
                        <h3>For the culture</h3>
                        <p>
                            Memes, art, strange experiments, lunch money, and ideas that are too
                            early—or too weird—for traditional crowdfunding.
                        </p>
                    </article>
                    <article className="site-card">
                        <span className="site-card__icon" aria-hidden="true">
                            <HeartHandshake size={22} />
                        </span>
                        <h3>When it matters</h3>
                        <p>
                            Mutual aid, animal care, urgent family expenses, and community
                            projects can reach supporters across borders.
                        </p>
                    </article>
                </div>
            </section>

            <section className="site-section" aria-labelledby="flow-title">
                <h2 className="site-section__heading" id="flow-title">
                    The shortest path from ask to support.
                </h2>
                <ol className="site-steps">
                    <li>
                        <div>
                            <h3>Choose how to sign in</h3>
                            <p>
                                Use an enabled Google, Apple, Telegram, or supported Web3 option.
                                Money Nerds exposes a stable public profile ID—not your provider
                                subject or email address.
                            </p>
                        </div>
                    </li>
                    <li>
                        <div>
                            <h3>Post what you need</h3>
                            <p>
                                Write the ask, add context, and choose the assets and destination
                                addresses you accept. The community can respond, discuss, and
                                decide what to support.
                            </p>
                        </div>
                    </li>
                    <li>
                        <div>
                            <h3>Receive support directly</h3>
                            <p>
                                A supporter chooses one of your funding routes and approves the
                                transfer in a compatible wallet or sending app. The selected
                                network settles directly to your address without a Money Nerds
                                platform fee.
                            </p>
                        </div>
                    </li>
                </ol>
                <p className="site-note">
                    <Info aria-hidden="true" size={18} />
                    Zero platform commission does not mean zero network cost. Each blockchain
                    sets its own fees, which the supporter should review before sending.
                </p>
            </section>

            <section className="site-callout" aria-labelledby="join-title">
                <div>
                    <p className="site-kicker">The public board is open</p>
                    <h2 id="join-title">A small ask can be a big answer.</h2>
                    <p>
                        Browse what people are sharing, sign in when you are ready, and decide
                        what deserves your support.
                    </p>
                </div>
                <Link className="site-button site-button--primary" href="/">
                    Explore Money Nerds <ArrowRight aria-hidden="true" size={17} />
                </Link>
            </section>
        </main>
    );
}
