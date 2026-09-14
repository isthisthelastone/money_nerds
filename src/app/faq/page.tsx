import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage, GuideSection } from "@/components/site/GuidePage";

const description = "Answers about Money Nerds sign-in, supported currencies, direct funding, public profiles, media recording, and experimental SBP transfers.";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title: "Money Nerds FAQ", description, url: "/faq" },
};

const questions = [
  {
    question: "Do I need a wallet to browse or sign in?",
    answer: "No. Public posts and profiles are readable without signing in. Choose an enabled option on the sign-in screen, such as an email code or Telegram. Supported wallet sign-in options are separate from the wallet you use to send or receive money. Google and Apple appear only when those providers are enabled.",
  },
  {
    question: "Does Money Nerds take a fee?",
    answer: "Money Nerds takes no platform commission from user donations. Network, wallet-provider, or bank fees may still apply. Support for running Money Nerds is voluntary and separate from funding another person's post.",
  },
  {
    question: "Which currencies can a post accept?",
    answer: "SOL, USDC, and USDT on Solana; ETH and USDT on Ethereum; BTC on Bitcoin; TRX and USDT on TRON; TON; and INJ on Injective. These are mainnet routes. A post shows only the options its author selected. A token name alone is not enough: the sender and recipient must use the same network.",
  },
  {
    question: "Can I publish after signing in with Telegram or email?",
    answer: "Yes. Your sign-in method identifies your Money Nerds account; it does not create a crypto wallet or receiving address. In the post composer, choose at least one accepted crypto asset and a matching address, or include a configured experimental SBP option. Add a nickname and your text or media before publishing.",
  },
  {
    question: "Where does the money go?",
    answer: "Crypto support goes directly to the destination saved on the post or offered in the funding dialog. Money Nerds does not hold a user balance. Destinations supplied by an author are not automatically proof of ownership. Check the destination in your wallet before approving.",
  },
  {
    question: "I sent a transfer. Why is it still pending?",
    answer: "A submitted transaction is not necessarily confirmed or verified yet. For manual routes, return to the funding dialog and enter its transaction ID. Check the explorer link and retry verification; do not send again just because the total has not updated. A transaction must match the recorded funding request before it counts as verified.",
  },
  {
    question: "Can I donate to a comment?",
    answer: "Yes, use the comment's Fund button when receiving options are available. Review whose destination is displayed: supporting a commenter is different from supporting the original post's author.",
  },
  {
    question: "Can I attach images, voice messages, or circle videos?",
    answer: "Yes, posts and comments support media attachments. Allow camera or microphone access when recording, choose an available device, and replay the result before publishing. Browser and device support vary. If recording is unavailable, you can still write a message or use an available upload option.",
  },
  {
    question: "Why does a nickname change but the profile stay the same?",
    answer: "A post or comment can have its own nickname while activity remains attached to a stable public profile. Profiles connect published posts, comments, and linked funding activity. A new nickname does not make earlier public activity private.",
  },
  {
    question: "Why can I not see SBP on every post?",
    answer: "SBP is experimental and off by default. You must sign in and enable it in settings; the author must also enable it and explicitly include it on that post. To only send support, you can leave your own phone and receiving-bank fields empty. Revealed receiving details can be copied by eligible viewers.",
  },
  {
    question: "Is every SBP QR code a bank payment QR?",
    answer: "No. A supported bank-issued collection link can open a bank transfer flow. Without one, the QR opens private Money Nerds instructions, not a prefilled bank payment. Follow the label, check the receiving bank and recipient, and confirm in your bank. SBP transfers are not counted in verified crypto donation totals.",
  },
  {
    question: "Does a verified donation mean a request is verified?",
    answer: "No. Transaction verification checks a transfer, not the truth of a story or how funds will be used. Money Nerds does not certify charities or guarantee requests. Read the context, ask questions, and decide for yourself before sending.",
  },
] as const;

export default function FaqPage() {
  return (
    <GuidePage
      path="/faq"
      title="A few things worth knowing."
      introduction="Plain answers before you post, connect a wallet, or send support. If a funding route is unclear, stop and check it first."
    >
      <GuideSection id="common-questions" title="Start here.">
        <div className="mt-8 grid gap-4">
          {questions.map(({ question, answer }) => (
            <article className="site-card" key={question}>
              <h3>{question}</h3>
              <p className="max-w-4xl">{answer}</p>
            </article>
          ))}
        </div>
      </GuideSection>
      <GuideSection id="more-help" title="Need the step-by-step version?">
        <p className="site-section__intro">Follow <Link className="text-[#c9ff55] underline underline-offset-4" href="/how-it-works">how it works</Link> to create or fund a post. Read <Link className="text-[#c9ff55] underline underline-offset-4" href="/safety">safety and privacy</Link> before sharing personal details, or use the <Link className="text-[#c9ff55] underline underline-offset-4" href="/community">community guide</Link> to make a clearer ask.</p>
        <p className="site-section__intro">Still stuck? Email <a className="break-all text-[#c9ff55] underline underline-offset-4" href="mailto:unluckypleasure@yandex.ru">unluckypleasure@yandex.ru</a> with the relevant public URL and what happened. Never include sign-in codes or wallet secrets.</p>
      </GuideSection>
    </GuidePage>
  );
}
