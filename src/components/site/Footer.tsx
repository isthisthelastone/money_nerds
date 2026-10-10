import { getTranslator } from "@/lib/i18n/server";
import Link from "next/link";
import {ArrowUpRight, BadgeDollarSign, Radio} from "lucide-react";
import {LanguageSwitcher} from "./LanguageSwitcher";
import {PrivacyChoicesButton} from "@/components/legal/PrivacyConsent";
import {ContactLink} from "@/components/legal/ContactLink";

export async function SiteFooter() {
  const t = await getTranslator();
    return (
        <footer className="site-footer">
            <div className="site-shell">
                <div className="site-footer__grid">
                    <div>
                        <Link className="site-logo" href="/" aria-label={t("Money Nerds home")}>
                            <span className="site-logo__mark" aria-hidden="true">
                                <BadgeDollarSign size={23} strokeWidth={2.4} />
                            </span>
                            <span className="site-logo__wordmark">
                                Money Nerds
                                <small>{t("Ask · Share · Fund")}</small>
                            </span>
                        </Link>
                        <p className="site-footer__mission"> {t("A public board where internet culture and direct generosity meet. Support goes straight to the recipient without a platform cut.")} </p>
                    </div>

                    <div>
                        <p className="site-footer__label">{t("Explore")}</p>
                        <nav className="site-footer__links" aria-label={t("Footer navigation")}>
                            <Link href="/">{t("Home")}</Link>
                            <Link href="/about">{t("About")}</Link>
                            <Link href="/transparency">{t("Transparency")}</Link>
                            <Link href="/how-it-works">{t("How it works")}</Link>
                            <Link href="/community">{t("Community guide")}</Link>
                        </nav>
                    </div>

                    <div>
                        <p className="site-footer__label">{t("Trust & help")}</p>
                        <div className="site-footer__links">
                            <Link href="/safety">{t("Safety & privacy")}</Link>
                            <Link href="/faq">{t("FAQ")}</Link>
                            <a
                                href="https://solscan.io/account/BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg"
                                rel="noreferrer"
                                target="_blank"
                            > {t("Public service ledger")} <ArrowUpRight aria-hidden="true" size={13} />
                            </a>
                            <ContactLink label={t("Contact")} />
                        </div>
                        <div className="site-footer__links mt-4">
                            <Link href="/legal">{t("Legal information")}</Link>
                            <Link href="/legal/privacy">{t("Privacy notice")}</Link>
                            <Link href="/legal/terms">{t("Terms of use")}</Link>
                            <Link href="/legal/cookies">{t("Cookies and storage")}</Link>
                            <Link href="/legal/regions">{t("Regional notices")}</Link>
                            <Link href="/legal/report">{t("Rights and reporting")}</Link>
                            <PrivacyChoicesButton />
                        </div>
                    </div>
                </div>
                <div className="my-5"><LanguageSwitcher /></div>

                <div className="site-footer__bottom">
                    <span>{t("© 2026 Money Nerds. Public profiles link activity.")}</span>
                    <span className="site-footer__direct">
                        <Radio aria-hidden="true" size={13} /> {t("Zero platform commission · Network or bank fees may apply")} </span>
                </div>
            </div>
        </footer>
    );
}
