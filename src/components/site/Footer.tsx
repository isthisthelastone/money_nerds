import Link from "next/link";
import {ArrowUpRight, BadgeDollarSign, Radio} from "lucide-react";

export function SiteFooter() {
    return (
        <footer className="site-footer">
            <div className="site-shell">
                <div className="site-footer__grid">
                    <div>
                        <Link className="site-logo" href="/" aria-label="Money Nerds home">
                            <span className="site-logo__mark" aria-hidden="true">
                                <BadgeDollarSign size={23} strokeWidth={2.4} />
                            </span>
                            <span className="site-logo__wordmark">
                                Money Nerds
                                <small>Ask · Share · Fund</small>
                            </span>
                        </Link>
                        <p className="site-footer__mission">
                            A public board where internet culture and direct generosity meet.
                            Support goes from one wallet to another without a platform cut.
                        </p>
                    </div>

                    <div>
                        <p className="site-footer__label">Explore</p>
                        <nav className="site-footer__links" aria-label="Footer navigation">
                            <Link href="/">Home</Link>
                            <Link href="/about">About</Link>
                            <Link href="/transparency">Transparency</Link>
                        </nav>
                    </div>

                    <div>
                        <p className="site-footer__label">Open ledger</p>
                        <div className="site-footer__links">
                            <a
                                href="https://solscan.io/account/BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg"
                                rel="noreferrer"
                                target="_blank"
                            >
                                Service wallet <ArrowUpRight aria-hidden="true" size={13} />
                            </a>
                            <a href="mailto:unluckypleasure@yandex.ru">Contact</a>
                        </div>
                    </div>
                </div>

                <div className="site-footer__bottom">
                    <span>© 2026 Money Nerds. Wallets are public identities.</span>
                    <span className="site-footer__direct">
                        <Radio aria-hidden="true" size={13} />
                        Zero platform commission · Network fees apply
                    </span>
                </div>
            </div>
        </footer>
    );
}
