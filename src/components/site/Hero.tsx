import Link from "next/link";
import {ArrowDown, ArrowRight, Blocks, CircleDollarSign, ShieldCheck} from "lucide-react";
import {HeroCoin} from "./HeroCoin";

export function Hero() {
    return (
        <section className="site-hero site-shell" aria-labelledby="money-nerds-title">
            <div className="site-hero__copy">
                <p className="site-kicker">Direct generosity across networks</p>
                <h1 id="money-nerds-title">
                    Ask. Share.
                    <em>Get funded.</em>
                </h1>
                <p className="site-hero__lede">
                    Post a meme, fund a real need, or back an idea. Money Nerds is a
                    public funding board where support moves directly between people.
                </p>

                <div className="site-actions">
                    <a className="site-button site-button--primary" href="#feed">
                        Explore requests <ArrowDown aria-hidden="true" size={17} />
                    </a>
                    <Link className="site-button site-button--secondary" href="/about">
                        How it works <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                </div>

                <ul className="site-trust-row" aria-label="Platform principles">
                    <li>
                        <CircleDollarSign aria-hidden="true" size={14} /> 0% platform fee
                    </li>
                    <li>
                        <Blocks aria-hidden="true" size={14} /> Public on-chain
                    </li>
                    <li>
                        <ShieldCheck aria-hidden="true" size={14} /> You approve every transfer
                    </li>
                </ul>
            </div>

            <HeroCoin />
        </section>
    );
}
