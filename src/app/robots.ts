import type {MetadataRoute} from "next";
import {SITE_URL} from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
    // Public HTML and assets remain crawlable, including by search-specific AI
    // bots. Account/settings/SBP pages use noindex instead of robots blocking:
    // crawlers must be able to read that directive. Private data is gated by
    // authentication, never by a robots.txt rule.
    return {
        rules: [
            {
                userAgent: [
                    "OAI-SearchBot",
                    "ChatGPT-User",
                    "Claude-SearchBot",
                    "Claude-User",
                    "Kimi-SearchBot",
                    "Kimi-User",
                    "PerplexityBot",
                    "Perplexity-User",
                    "Googlebot",
                    "Bingbot",
                    "YandexBot",
                ],
                allow: "/",
                disallow: ["/api/"],
            },
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/api/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
