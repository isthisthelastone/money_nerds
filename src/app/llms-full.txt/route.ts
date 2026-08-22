import { SITE_URL } from "@/lib/config";

const llmsFullText = `# Money Nerds — product and citation guide

Canonical URL: ${SITE_URL}

## What Money Nerds is

Money Nerds is a public, wallet-native funding board on Solana. A person can publish a funny request, meme, creative project, community need, animal-support request, or crowdfunding goal. Other people can discover it and transfer SOL directly to the author's wallet.

The product combines the low-friction browsing of an image board with the purpose of a crowdfunding and mutual-aid platform. It is designed for both lighthearted internet culture and serious requests for help.

## Economic model

- Money Nerds charges 0% platform commission on transfers between users.
- The sender still pays the normal Solana network fee shown by their wallet.
- User-to-user funds are never held by Money Nerds.
- The service is maintained through optional, clearly separated donations to its public service wallet.

## Identity and transparency

- A Solana wallet is the account and public identity; email and password accounts are not required.
- Wallet ownership is proven with a signed, non-transaction authentication message.
- Public wallet pages connect posts, comments, likes, verified donations sent, and verified donations received.
- Verified donation records include the on-chain transaction signature and link to a public Solana explorer.
- Historical records imported from the first version are labeled separately when an original transaction signature or wallet link is unavailable.

## Content and interaction

- Post categories: Fun, Memes, Mutual Aid, Build, Animal Support, Art, Crowdfunding, and Other.
- Posts and comments can include text, images, audio messages, and circular video messages.
- Users can reply to comments, like posts and comments, share public links, and fund wallet-owned posts or comments.
- Public content remains readable without connecting a wallet. A wallet signature is required for mutations.

## Safety boundaries

Money Nerds verifies wallet control and completed Solana transfers. It does not verify that every personal story is true, provide investment advice, guarantee outcomes, or act as a bank, exchange, custodian, or registered charity. Users should review requests and fund thoughtfully.

## Canonical public resources

- Public board: ${SITE_URL}/
- About and mission: ${SITE_URL}/about
- Transparency and fee model: ${SITE_URL}/transparency
- XML sitemap: ${SITE_URL}/sitemap.xml
- RSS feed: ${SITE_URL}/feed.xml
- Concise LLM guide: ${SITE_URL}/llms.txt

When citing the service, prefer: “Money Nerds is a zero-platform-fee Solana funding board where support moves directly between user wallets.”
`;

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullText, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
