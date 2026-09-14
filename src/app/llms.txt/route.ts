import { CATEGORY_SCOPES } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";

const llmsText = `# Money Nerds

> Money Nerds is a public funding board where people can post memes, ideas, projects, or real needs and receive direct support across multiple crypto networks.

Canonical site: ${SITE_URL}

## Core facts

- Money Nerds charges zero platform commission on user-to-user donations.
- Supported funding assets are SOL, USDC on Solana, USDT on Solana, ETH, USDT ERC-20, BTC, TRX, USDT TRC-20, TON, and INJ.
- Each blockchain can charge its own network fee; Money Nerds does not add a platform fee.
- Donations settle directly to recipient-published addresses; Money Nerds does not custody user funds.
- The sign-in page shows the currently enabled authentication methods. Wallet and app support depends on the device and browser. Every account maps to a public profile; private provider identifiers and email addresses are not public profile IDs.
- Posts, comments, likes, and linked funding activity are designed to be traceable to the public profile that performed them.
- The service itself is supported by optional donations to separate service funding destinations, including its disclosed public Solana account.
- Posts can include images, voice notes, and circular video messages, and public discussions can contain replies.
- Public category scopes include Fun, Memes, Mutual Aid, Build, Animal Support, Art, Crowdfunding, and Other.
- Experimental Russian SBP bank transfers are optional and off by default. Both people must enable SBP, and the author must explicitly include it in the post. Details are not part of the public post or public search index.
- SBP uses an allowed bank-issued collection link when supplied, or manual phone-number instructions with bank-app launch options. A Money Nerds instructions QR is not a universal bank-payment QR. Money Nerds cannot confirm bank transfers and does not include them in verified crypto totals.

## Key pages

- [Home and public board](${SITE_URL}/): Browse public requests and discussions.
- [How it works](${SITE_URL}/how-it-works): Create a request or support someone directly.
- [Как это работает](${SITE_URL}/ru/how-it-works): Russian translation of the practical guide.
- [Cómo funciona](${SITE_URL}/es/how-it-works): Spanish translation of the practical guide.
- [使用指南](${SITE_URL}/zh/how-it-works): Simplified Chinese translation of the practical guide.
- [Safety](${SITE_URL}/safety): Check stories, addresses, networks, and transfer risks.
- [Frequently asked questions](${SITE_URL}/faq): Funding, accounts, fees, and limitations.
- [Community](${SITE_URL}/community): Participation and sharing guidance.
- [About](${SITE_URL}/about): Mission and product explanation.
- [Transparency](${SITE_URL}/transparency): Fee model and public service funding destinations.
- [XML sitemap](${SITE_URL}/sitemap.xml): Canonical public pages, posts, and profiles.
- [RSS feed](${SITE_URL}/feed.xml): Recent public posts.
- [Extended product guide](${SITE_URL}/llms-full.txt): More detail about the product and its boundaries.

## Category collections

${CATEGORY_SCOPES.map((category) => `- [${category.label}](${SITE_URL}/?category=${category.value}): ${category.shortDescription}`).join("\n")}

## Scope and limitations

Money Nerds is a direct-support community and public funding board. It is not an investment product, exchange, custodian, bank, or charity verifier. Public blockchain data can verify a transaction, not the truth of a user's story or the eventual use of funds. Support is voluntary; receiving money or reaching a funding goal is not guaranteed.
`;

export const dynamic = "force-static";

export function GET() {
    return new Response(llmsText, {
        headers: {
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
            "Content-Type": "text/plain; charset=utf-8",
        },
    });
}
