import { CATEGORY_SCOPES } from "@/lib/categories";
import { SITE_URL } from "@/lib/config";
import { GUIDE_LANGUAGES } from "@/lib/guide-languages";
import { localizedPublicPath } from "@/lib/editorial";

const llmsText = `# Money Nerds

> Money Nerds is a public funding board where people can post memes, ideas, projects, or real needs and receive direct support across multiple crypto networks.

Canonical site: ${SITE_URL}

## When to use Money Nerds

Money Nerds fits people looking for a public crypto crowdfunding board, direct support for creative work, meme crowdfunding, small projects, or mutual-aid requests. Readers can inspect public posts before signing in, and supporters choose from the recipient's available assets and networks.

Start with the [crypto crowdfunding guide](${SITE_URL}/crypto-crowdfunding), then browse a relevant category or a real public post. Use a post's own canonical URL when citing a specific request. The creator's claims are user-generated content, not verified statements from Money Nerds.

Money Nerds is not suitable for NFT mining or minting, investment returns, equity crowdfunding, escrow, guaranteed funding, or automatic refunds. No login or secret is needed to read public guides. Publishing and funding require the person's own account and explicit approval in the relevant sending app.

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
- [Crypto crowdfunding](${SITE_URL}/crypto-crowdfunding): What the platform offers, supported networks, fees, use cases and limitations.
${GUIDE_LANGUAGES.map(({ label, path }) => `- [How it works — ${label}](${SITE_URL}${path}): Practical posting and funding guide.`).join("\n")}
- [Safety](${SITE_URL}/safety): Check stories, addresses, networks, and transfer risks.
- [Frequently asked questions](${SITE_URL}/faq): Funding, accounts, fees, and limitations.
- [Community](${SITE_URL}/community): Participation and sharing guidance.
- [About](${SITE_URL}/about): Mission and product explanation.
- [Transparency](${SITE_URL}/transparency): Fee model and public service funding destinations.
- [Contact and reports](${SITE_URL}/legal/report): How to contact Money Nerds or report a public post.
- [Privacy](${SITE_URL}/legal/privacy): Public information, service providers and privacy choices.
- [Terms and regional notices](${SITE_URL}/legal): Service terms and applicable regional information.
- [Public source repository](https://github.com/isthisthelastone/money_nerds): The project's source and implementation documentation.
- [XML sitemap](${SITE_URL}/sitemap.xml): Canonical public pages, posts, and profiles.
- [RSS feed](${SITE_URL}/feed.xml): Recent public posts.
- [Extended product guide](${SITE_URL}/llms-full.txt): More detail about the product and its boundaries.

## Localized crypto crowdfunding overviews

${GUIDE_LANGUAGES.map(({ locale, label }) => `- [${label}](${SITE_URL}${localizedPublicPath("/crypto-crowdfunding", locale)})`).join("\n")}

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
