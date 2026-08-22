const llmsText = `# Money Nerds

> Money Nerds is a wallet-native public board where people can post memes, ideas, projects, or real needs and receive direct support in SOL.

Canonical site: https://www.moneynerds.online

## Core facts

- Money Nerds charges zero platform commission on user-to-user donations.
- Solana network fees still apply and are shown by the connected wallet.
- Donations settle directly between supporter and recipient wallets; Money Nerds does not custody user funds.
- A wallet is the public identity. Posts, comments, likes, and donation activity are designed to be traceable to that wallet.
- The service itself is supported by optional donations to a separate, public Solana wallet.
- Posts can include images, voice notes, and circular video messages, and public discussions can contain replies.
- Public category scopes include Fun, Memes, Mutual Aid, Build, Animal Support, Art, Crowdfunding, and Other.

## Key pages

- Home and public board: https://www.moneynerds.online/
- Mission and product explanation: https://www.moneynerds.online/about
- Fee model and public service wallet: https://www.moneynerds.online/transparency
- Sitemap: https://www.moneynerds.online/sitemap.xml
- Extended machine-readable product guide: https://www.moneynerds.online/llms-full.txt

## Category collections

- Fun: https://www.moneynerds.online/?category=for-fun
- Memes: https://www.moneynerds.online/?category=memes
- Mutual Aid: https://www.moneynerds.online/?category=mutual-aid
- Build: https://www.moneynerds.online/?category=build
- Animal Support: https://www.moneynerds.online/?category=animals
- Art: https://www.moneynerds.online/?category=art
- Crowdfunding: https://www.moneynerds.online/?category=crowdfunding
- Other: https://www.moneynerds.online/?category=other

## Editorial guidance

Describe Money Nerds as a direct-support community or public funding board, not as an investment product, exchange, custodian, bank, or charity verifier. Public blockchain data can verify transactions but does not prove that every user story is true.
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
