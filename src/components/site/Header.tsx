import Link from "next/link";
import type {ReactNode} from "react";
import {BadgeDollarSign, Menu} from "lucide-react";
import {CategoryNav} from "./CategoryNav";

const navigation = [
    {href: "/", label: "Home"},
    {href: "/about", label: "About"},
    {href: "/transparency", label: "Transparency"},
] as const;

export interface SiteHeaderProps {
    /** Pass the app's connected-wallet control here. The header owns no wallet state. */
    walletControl?: ReactNode;
    /** Children are accepted as a shorthand wallet-control slot. */
    children?: ReactNode;
}

export function SiteHeader({walletControl, children}: SiteHeaderProps) {
    const walletSlot = walletControl ?? children;

    return (
        <header className="site-header">
            <div className="site-header__inner site-shell">
                <Link className="site-logo" href="/" aria-label="Money Nerds home">
                    <span className="site-logo__mark" aria-hidden="true">
                        <BadgeDollarSign size={23} strokeWidth={2.4} />
                    </span>
                    <span className="site-logo__wordmark">
                        Money Nerds
                        <small>Ask · Share · Fund</small>
                    </span>
                </Link>

                <nav className="site-nav" aria-label="Primary navigation">
                    {navigation.map((item) => (
                        <Link className="site-nav__link" href={item.href} key={item.href}>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {walletSlot ? (
                    <div className="site-header__wallet" data-wallet-slot>
                        {walletSlot}
                    </div>
                ) : null}

                <details className="site-mobile-nav">
                    <summary aria-label="Open navigation menu">
                        <Menu size={19} aria-hidden="true" />
                    </summary>
                    <nav className="site-mobile-nav__panel" aria-label="Mobile navigation">
                        {navigation.map((item) => (
                            <Link className="site-nav__link" href={item.href} key={item.href}>
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </details>
            </div>
            <CategoryNav />
        </header>
    );
}
