import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage, GuideSection } from "@/components/site/GuidePage";
import { SOCIAL_PREVIEW_IMAGE } from "@/lib/social-preview";

const description = "Protect your wallet and privacy on Money Nerds: check recipients, understand public profiles, use SBP carefully, and report suspicious posts.";

export const metadata: Metadata = {
  title: "Safety and privacy",
  description,
  alternates: { canonical: "/safety" },
  openGraph: { title: "Money Nerds safety and privacy", description, url: "/safety", images: [SOCIAL_PREVIEW_IMAGE] },
};

export default function SafetyPage() {
  return (
    <GuidePage
      path="/safety"
      title="Generosity deserves a careful check."
      introduction="Money Nerds connects people; it does not certify their stories or guarantee how they will use support. You choose whom to trust and approve every transfer in your own wallet or bank."
    >
      <GuideSection id="before-sending" title="Pause before you send.">
        <ol className="site-steps">
          <li><div><h3>Check the person and the request</h3><p>Read the full post, public profile, and conversation. Look for a clear purpose and consistent context. Ask questions if something is unclear. Urgency, a compelling photo, or an old account is not proof; do not let pressure replace your judgment.</p></div></li>
          <li><div><h3>Check the actual transfer</h3><p>Compare the final recipient address, amount, asset, and network in your wallet with the funding dialog. For SBP, check the receiving bank and the recipient name your bank displays before confirming. Stop if anything differs from what you intended.</p></div></li>
          <li><div><h3>Understand the limit of a receipt</h3><p>A verified blockchain transaction can show that a transfer matched a recorded funding request. It does not prove a person’s identity, medical condition, ownership of an image, or eventual use of the money. Money Nerds cannot reverse a blockchain transfer or promise a refund.</p></div></li>
        </ol>
      </GuideSection>

      <GuideSection id="keep-secrets-private" title="Your secrets never belong in a post.">
        <div className="site-bento">
          <article className="site-card"><h3>Protect your wallet</h3><p>Never share a seed phrase, private key, recovery code, password, or one-time sign-in code. A person offering help does not need those secrets. Review any wallet signature request; do not approve a transaction you do not understand.</p></article>
          <article className="site-card"><h3>Protect your personal details</h3><p>Do not upload identity documents, full medical records, home addresses, or bank statements. If context is useful, describe it without identifying details. Obtain consent before sharing another person’s story, face, or voice.</p></article>
          <article className="site-card"><h3>Protect your next click</h3><p>Open Money Nerds at <a className="text-[#c9ff55] underline underline-offset-4" href="https://www.moneynerds.online/">www.moneynerds.online</a>. Treat links and instructions in user posts as untrusted. Do not install remote-access software or send an “unlock” payment to receive help.</p></article>
        </div>
      </GuideSection>

      <GuideSection id="public-activity" title="Public is not anonymous.">
        <p className="site-section__intro">Posts, comments, their nicknames, attached media, and linked funding activity can be viewed on public pages. Receiving crypto addresses and blockchain transactions are public. Your sign-in email is not your public profile ID, but a nickname or wallet can still connect your activity to you elsewhere.</p>
        <p className="site-section__intro">Share only what you are comfortable having copied, indexed, or kept by someone else. Removing something from the site cannot remove copies or blockchain records. Before recording, check the background and who else can be seen or heard.</p>
      </GuideSection>

      <GuideSection id="sbp-privacy" title="Extra care with experimental SBP.">
        <p className="site-section__intro">Both people must enable SBP, and the author must include it on the post. This limits access inside Money Nerds; it cannot stop an eligible viewer from saving or sharing the revealed phone number and bank link.</p>
        <p className="site-section__intro">A bank-issued link and an instructions-only QR are different. The latter opens Money Nerds instructions, not a prefilled payment in a bank. Open your bank through its own app or the provided official route, enter the details, and verify the recipient before sending. Changing saved details affects new posts; turning SBP off and saving permanently removes its receiving details from earlier posts. SBP payments are not independently verified in the crypto totals.</p>
      </GuideSection>

      <GuideSection id="report-a-problem" title="Something looks wrong? Tell us.">
        <p className="site-section__intro">Send the public post or profile URL and a short explanation to <a className="break-all text-[#c9ff55] underline underline-offset-4" href="mailto:unluckypleasure@yandex.ru">unluckypleasure@yandex.ru</a>. For a funding problem, include the network and public transaction ID if available—not wallet secrets, passwords, or unredacted personal documents.</p>
        <p className="site-section__intro">If a transfer may already have gone wrong, stop sending and contact your bank or wallet provider through its official support channel. Reporting a post does not reverse a transfer. For ordinary setup questions, start with the <Link className="text-[#c9ff55] underline underline-offset-4" href="/faq">FAQ</Link>.</p>
      </GuideSection>
    </GuidePage>
  );
}
