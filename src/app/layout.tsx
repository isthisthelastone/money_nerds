import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WalletControl } from "@/components/features/WalletControl";
import { SiteFooter, SiteHeader } from "@/components/site";
import { SITE_URL } from "@/lib/config";
import { serializeJsonLd } from "@/lib/seo";
import { ClientProvider } from "./ClientProvider";
import "../styles/global.css";

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    applicationName: "Money Nerds",
    title: {
        default: "Money Nerds — Crypto Crowdfunding & Direct Support",
        template: "%s | Money Nerds",
    },
    description:
        "Share a meme, creative project, or real need. Give and receive direct crypto support on Money Nerds, with 0% platform commission. Network fees still apply.",
    creator: "Money Nerds",
    publisher: "Money Nerds",
    category: "community",
    verification: {
        ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
        ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
    },
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
        title: "Money Nerds — Crypto Crowdfunding & Direct Support",
        description:
            "Post a meme, fund a need, or back an idea. Support moves directly between people across leading crypto networks.",
        images: [
            {
                url: "/og.png",
                width: 1733,
                height: 907,
                alt: "Money Nerds — Ask. Share. Fund. Zero platform fees and direct multi-currency support.",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Money Nerds — Crypto Crowdfunding & Direct Support",
        description:
            "A public board for direct multi-currency support, with zero platform commission.",
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

const publisherJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Money Nerds",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.svg`,
    description: "A public funding board for direct support between people, with zero platform commission.",
};

export default function RootLayout({children}: Readonly<{children: ReactNode}>) {
    return (
        <html lang="en">
            <body>
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(publisherJsonLd) }} />
                <ClerkProvider
                    dynamic
                    signInUrl="/sign-in"
                    signUpUrl="/sign-up"
                    signInFallbackRedirectUrl="/"
                    signUpFallbackRedirectUrl="/"
                    appearance={{
                        variables: {
                            colorPrimary: "#c7ff42",
                            colorBackground: "#111411",
                            colorForeground: "#f2eee4",
                            colorMutedForeground: "#a5ada2",
                            borderRadius: "0.9rem",
                        },
                    }}
                >
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
                </ClerkProvider>
            </body>
        </html>
    );
}
