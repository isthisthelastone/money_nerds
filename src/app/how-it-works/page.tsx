import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { GuidePage, GuideSection } from "@/components/site/GuidePage";

const description = "Learn how to create a Money Nerds post, choose receiving addresses, and support someone directly on the right crypto network.";

export const metadata: Metadata = {
  title: "How it works",
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: { title: "How Money Nerds works", description, url: "/how-it-works" },
};

const networks = [
  ["Solana", "SOL, USDC, and USDT on Solana"],
  ["Ethereum", "ETH and USDT on Ethereum (ERC-20)"],
  ["Bitcoin", "BTC on Bitcoin"],
  ["TRON", "TRX and USDT on TRON (TRC-20)"],
  ["TON", "TON on The Open Network"],
  ["Injective", "INJ on Injective"],
] as const;

export default function HowItWorksPage() {
  return (
    <GuidePage
      path="/how-it-works"
      title="Your first ask. Your first act of support."
      introduction="Money Nerds is a public board for ideas, memes, creative work, and real needs. A post starts the conversation; support goes directly to a receiving destination its author supplies."
    >
      <GuideSection id="create-an-ask" title="Create an ask people can understand.">
        <ol className="site-steps">
          <li><div><h3>Sign in, then choose a category</h3><p>Use an option shown on the sign-in screen. Open the <Link className="text-[#c9ff55] underline underline-offset-4" href="/#feed">board composer</Link>, or start in a category such as <Link className="text-[#c9ff55] underline underline-offset-4" href="/?category=build#feed">Build</Link> or <Link className="text-[#c9ff55] underline underline-offset-4" href="/?category=mutual-aid#feed">Mutual Aid</Link>. Its category is preselected; you can change it before publishing.</p></div></li>
          <li><div><h3>Give the ask some context</h3><p>Choose a public nickname and explain what you want to do, what support would cover, and any relevant timing. Add your own images, a voice message, or a circle video if they help. Preview recordings before publishing and keep private documents out of your attachments.</p></div></li>
          <li><div><h3>Choose where support can arrive</h3><p>Select each asset you accept and paste your receiving address for that exact mainnet. Check it in your wallet. A sign-in account is not a payment address. You need at least one crypto destination, or a configured experimental SBP option included for this post.</p></div></li>
          <li><div><h3>Publish and share the post itself</h3><p>Review the nickname, text, media, and destinations, then publish. Open the individual post and use Share, or copy its browser URL. Funding destinations are saved with that post; changing your profile later does not silently redirect its Fund button.</p></div></li>
        </ol>
      </GuideSection>

      <GuideSection id="support-a-post" title="Support someone, one careful step at a time.">
        <ol className="site-steps">
          <li><div><h3>Read before you fund</h3><p>Open the post, read its comments, and inspect the author’s public profile. Ask for clarification when needed. A public profile or transaction history does not verify the truth of a story.</p></div></li>
          <li><div><h3>Choose an offered asset and network</h3><p>Sign in and select Fund. Choose one of the recipient’s available routes and enter an amount. The asset and network in your sending wallet must both match: USDT on Ethereum is not USDT on TRON or Solana.</p></div></li>
          <li><div><h3>Review and approve in your wallet</h3><p>Check the recipient, amount, asset, network, and fees in the final wallet screen. A compatible connected wallet may handle the transfer directly. Other routes provide a payment request, QR code, or address to use in your sending app; wallet support varies.</p></div></li>
          <li><div><h3>Return to check the result</h3><p>For a manual transfer, paste the transaction ID into the funding dialog for verification. A submitted or pending transaction is not yet a verified donation. If it is still pending, check its explorer link and retry verification rather than sending the money again.</p></div></li>
        </ol>
        <p className="site-note"><Info aria-hidden="true" size={18} />Money Nerds takes no platform commission and does not hold a user balance. Network and sending-provider fees may apply. Read <Link className="underline underline-offset-4" href="/transparency">how the money flow works</Link>.</p>
      </GuideSection>

      <GuideSection id="supported-networks" title="Same asset. Same network. Every time.">
        <p className="site-section__intro">These are the available crypto routes. Each post offers only the destinations its author selected; all are mainnet routes.</p>
        <div className="site-bento">
          {networks.map(([network, assets]) => <article className="site-card" key={network}><h3>{network}</h3><p>{assets}</p></article>)}
        </div>
      </GuideSection>

      <GuideSection id="sbp-option" title="SBP is a separate, experimental option.">
        <p className="site-section__intro">SBP personal bank transfers are off by default. Enable them in <Link className="text-[#c9ff55] underline underline-offset-4" href="/settings">settings</Link>; receiving also requires your +7 phone number and a receiving bank. Include SBP separately on each new post. Only signed-in people who also enable it can reveal those details, but they can still copy or share them.</p>
        <p className="site-section__intro">A supported bank-issued collection link can open the bank’s transfer flow. Without one, the QR opens private instructions—not a bank payment request—and you enter the details yourself. Bank fees may apply; SBP transfers are not included in verified crypto donation totals. See the <Link className="text-[#c9ff55] underline underline-offset-4" href="/safety">safety guide</Link> before sharing receiving details.</p>
      </GuideSection>
    </GuidePage>
  );
}
