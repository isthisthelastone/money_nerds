import { SITE_URL } from "@/lib/config";

const llmsFullText = `# Money Nerds — product guide

Canonical URL: ${SITE_URL}

## What Money Nerds is

Money Nerds is a public, multi-network funding board. A person can publish a funny request, meme, creative project, community need, animal-support request, or crowdfunding goal. Other people can discover it and send a supported crypto asset directly to an address published for that request.

The product combines the low-friction browsing of an image board with the purpose of a crowdfunding and mutual-aid platform. It is designed for both lighthearted internet culture and serious requests for help.

## Economic model

- Money Nerds charges 0% platform commission on transfers between users.
- The sender still pays any fee charged by the selected blockchain or sending service.
- User-to-user funds are never held by Money Nerds.
- The service is maintained through optional, clearly separated donations to its public service funding destinations.

## Supported funding assets

- Solana: SOL, USDC on Solana, and USDT on Solana.
- Ethereum: ETH and USDT ERC-20.
- Bitcoin: BTC.
- TRON: TRX and USDT TRC-20.
- TON: TON.
- Injective: INJ.
- Authors select a destination address for each asset they accept. Supporters choose an available asset before funding a post or comment.

## Identity and transparency

- The sign-in page lists currently enabled methods. Signing in and choosing how to receive funding are separate steps. Wallet-app support depends on the wallet, device, and browser; an installed bank or wallet app is not proof that every integration will work on that device.
- Every authenticated account maps to a stable public Money Nerds profile stored in Supabase. Provider subjects and email addresses are not exposed as public profile identifiers.
- A sign-in identity and a funding destination are distinct: an author can publish network-specific recipient addresses for the assets they accept.
- Public profile pages connect posts, comments, verified donations sent, and verified donations received.
- Verified donation records include an on-chain transaction identifier and link to the relevant network explorer.
- Historical records imported from the first version are labeled separately when an original transaction signature or wallet link is unavailable.

## Experimental SBP transfers

- SBP is an optional Russian phone-number bank-transfer feature, disabled by default.
- To receive through SBP, an author enables it in settings, supplies a +7 number and receiving bank choices, and explicitly includes the option in a post. People who want to view those instructions must also sign in and enable SBP.
- The recipient may attach an allowed bank-issued personal collection link. Otherwise, the flow shows manual instructions, a copyable phone number, the receiving bank, and available sending-bank app or online-banking links.
- Opening a bank app does not automatically fill in or complete a transfer. Supporters must verify the recipient displayed by their bank, the receiving bank, amount, and any bank fees before confirming.
- A QR can lead to a recipient-supplied bank collection page or to the private Money Nerds instructions page. Money Nerds does not generate a universal SBP person-to-person payment QR from a phone number.
- SBP phone details are excluded from public post HTML, public profiles, RSS, sitemaps, and these guides. Eligible viewers can still copy or share information after it is revealed; access control is not a promise of secrecy.
- Money Nerds cannot independently verify SBP completion. SBP transfers do not contribute to verified on-chain donation totals.

## Content and interaction

- Post categories: Fun, Memes, Mutual Aid, Build, Animal Support, Art, Crowdfunding, and Other.
- Posts and comments can include text, images, audio messages, and circular video messages.
- Users can reply to comments, like posts and comments, share public links, and fund posts or comments with published routes.
- Public content remains readable without signing in. Creating content and social actions require an authenticated profile; funding also requires approval in the relevant wallet or sending app.

## Safety boundaries

Money Nerds links actions to authenticated profiles and verifies supported completed on-chain transfers. A verified transaction does not verify a personal story, charity status, or how money will be spent. Self-declared recipient addresses are not necessarily proven to belong to the profile owner. There is no guarantee that a request will receive funding, reach a goal, or deliver a promised outcome.

Money Nerds does not provide investment advice, act as an exchange or custodian, offer bank services, or verify registered charities. Before funding, users should review the request and destination, match the asset to its network, check all fees, and verify the recipient shown by the sending app. Money Nerds cannot reverse a confirmed blockchain transfer; a bank transfer must be handled through the relevant bank.

## Canonical public resources

- [Public board](${SITE_URL}/)
- [How it works](${SITE_URL}/how-it-works)
- [Safety and transfer risks](${SITE_URL}/safety)
- [Frequently asked questions](${SITE_URL}/faq)
- [Community participation](${SITE_URL}/community)
- [About and mission](${SITE_URL}/about)
- [Transparency and fee model](${SITE_URL}/transparency)
- [XML sitemap](${SITE_URL}/sitemap.xml)
- [RSS feed](${SITE_URL}/feed.xml)
- [Concise product guide](${SITE_URL}/llms.txt)

Public posts have stable URLs in the form ${SITE_URL}/p/{post_id}. A post's author link opens its public profile. Specific claims by authors are user-generated content, not endorsements or verified statements by Money Nerds.
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
