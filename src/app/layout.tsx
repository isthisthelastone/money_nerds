import { ClerkProvider } from "@clerk/nextjs";
import { enGB, esES, ruRU, viVN, zhCN } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { WalletControl } from "@/components/features/WalletControl";
import { SiteFooter, SiteHeader } from "@/components/site";
import { SITE_URL } from "@/lib/config";
import { serializeJsonLd } from "@/lib/seo";
import { SOCIAL_PREVIEW_IMAGE } from "@/lib/social-preview";
import { ClientProvider } from "./ClientProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { PrivacyConsentProvider } from "@/components/legal/PrivacyConsent";
import { getRequestPreferences } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import { makeTranslator } from "@/lib/i18n/config";
import { readPrivacyChoice } from "@/lib/privacy";
import { cookies, headers } from "next/headers";
import { translateMetadata } from "@/lib/i18n/metadata";
import "../styles/global.css";

const baseMetadata: Metadata = {
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
        images: [SOCIAL_PREVIEW_IMAGE],
    },
    twitter: {
        card: "summary_large_image",
        title: "Money Nerds — Crypto Crowdfunding & Direct Support",
        description:
            "A public board for direct multi-currency support, with zero platform commission.",
        images: [SOCIAL_PREVIEW_IMAGE],
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

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestPreferences();
  return translateMetadata(baseMetadata, makeTranslator(getMessages(locale)), locale);
}

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

export default async function RootLayout({children}: Readonly<{children: ReactNode}>) {
    const { locale, country } = await getRequestPreferences();
    const messages = getMessages(locale);
    const t = makeTranslator(messages);
    const privacyChoice = (await headers()).get("sec-gpc") === "1" ? "necessary" : readPrivacyChoice((await cookies()).get("mn_privacy")?.value);
    return (
        <html lang={locale === "zh" ? "zh-Hans" : locale}>
            <body>
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(publisherJsonLd) }} />
                <ClerkProvider
                    dynamic
                    localization={{ en: enGB, es: esES, zh: zhCN, ru: ruRU, vi: viVN }[locale]}
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
                    <a key="skip-content" className="skip-link" href="#main-content">
                        {t("Skip to content")}
                    </a>
                    <I18nProvider key="language-app" locale={locale} country={country} messages={messages}>
                    <PrivacyConsentProvider initialChoice={privacyChoice}>
                    <ClientProvider>
                        <div className="site-app">
                            <SiteHeader walletControl={<WalletControl />} />
                            <div className="site-main" id="main-content" tabIndex={-1}>
                                {children}
                            </div>
                            <SiteFooter />
                        </div>
                    </ClientProvider>
                    </PrivacyConsentProvider>
                    </I18nProvider>
                </ClerkProvider>
            </body>
        </html>
    );
}
