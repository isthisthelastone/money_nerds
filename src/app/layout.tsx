import type {Metadata, Viewport} from "next";
import type {ReactNode} from "react";
import {WalletControl} from "@/components/features/WalletControl";
import {SiteFooter, SiteHeader} from "@/components/site";
import {SITE_URL} from "@/lib/config";
import {ClientProvider} from "./ClientProvider";
import "../styles/global.css";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    applicationName: "Money Nerds",
    title: {
        default: "Money Nerds — Ask. Share. Fund.",
        template: "%s | Money Nerds",
    },
    description:
        "A wallet-native public board where memes, ideas, and real needs can receive direct support in SOL with zero platform commission.",
    keywords: [
        "Money Nerds",
        "Solana donations",
        "peer-to-peer funding",
        "mutual aid",
        "wallet-native community",
    ],
    creator: "Money Nerds",
    publisher: "Money Nerds",
    category: "community",
    alternates: {
        types: {
            "application/rss+xml": `${SITE_URL}/feed.xml`,
        },
    },
    icons: {
        icon: "/icon.svg",
        shortcut: "/icon.svg",
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: SITE_URL,
        siteName: "Money Nerds",
        title: "Money Nerds — Ask. Share. Fund.",
        description:
            "Post a meme, fund a need, or back an idea. Support moves directly between Solana wallets.",
        images: [
            {
                url: "/og.png",
                width: 1733,
                height: 907,
                alt: "Money Nerds — Ask. Share. Fund. Zero platform fees and direct Solana support.",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Money Nerds — Ask. Share. Fund.",
        description:
            "A wallet-native public board for direct Solana support, with zero platform commission.",
        images: ["/og.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: "dark",
    themeColor: "#090b09",
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
    return (
        <html lang="en">
            <body>
                <a className="skip-link" href="#main-content">
                    Skip to content
                </a>
                <ClientProvider>
                    <div className="site-app">
                        <SiteHeader walletControl={<WalletControl />} />
                        <div className="site-main" id="main-content" tabIndex={-1}>
                            {children}
                        </div>
                        <SiteFooter />
                    </div>
                </ClientProvider>
            </body>
        </html>
    );
}
