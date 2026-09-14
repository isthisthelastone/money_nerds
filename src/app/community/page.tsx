import type { Metadata } from "next";
import Link from "next/link";
import { GuidePage, GuideSection } from "@/components/site/GuidePage";
import { CATEGORY_SCOPES, categoryHref } from "@/lib/categories";

const description = "Make a clear Money Nerds ask, choose a useful category, share your post respectfully, and help the community without misleading people.";

export const metadata: Metadata = {
  title: "Community guide",
  description,
  alternates: { canonical: "/community" },
  openGraph: { title: "Money Nerds community guide", description, url: "/community" },
};

export default function CommunityPage() {
  return (
    <GuidePage
      path="/community"
      title="Make a good ask. Be a good neighbor."
      introduction="A joke can belong here. So can a serious need. Help people understand which one they are reading, what support would change, and how they can respond."
    >
      <GuideSection id="clear-ask" title="Give someone enough context to care.">
        <ol className="site-steps">
          <li><div><h3>Say what you are asking for</h3><p>Lead with the actual need or idea. Is it a drawing, food for a rescue animal, a prototype, or a deliberately silly experiment? Be specific instead of relying on a vague request for money.</p></div></li>
          <li><div><h3>Explain what support would cover</h3><p>Describe the next useful step and, when relevant, the amount and timing. Separate estimates from known costs. Do not promise an outcome you cannot control, imply guaranteed funding, or present a joke as someone else’s emergency.</p></div></li>
          <li><div><h3>Add useful context, not private records</h3><p>Your own image, voice message, or circle video can explain more than extra text. Use material you have permission to share. Do not publish another person’s medical documents, phone number, or personal story without their consent.</p></div></li>
          <li><div><h3>Stay in the conversation</h3><p>Answer reasonable questions and add honest updates in the comments. If your plan changes, say so. A thank-you or a progress update helps readers understand what happened without inventing a success story.</p></div></li>
        </ol>
        <article className="site-card mt-8">
          <h3>A structure you can adapt</h3>
          <p>“I’m working on / need ____. Support would cover ____. My next step is ____. The timing is ____. Here is the context I can safely share: ____.”</p>
          <p>This is a writing prompt, not a real request. Leave out anything that does not fit; use your own words.</p>
        </article>
      </GuideSection>

      <GuideSection id="choose-category" title="Put your post where it makes sense.">
        <p className="site-section__intro">Choose the closest category, rather than publishing the same ask across several. Starting from a category preselects it in the composer.</p>
        <div className="site-bento">
          {CATEGORY_SCOPES.map((category) => (
            <article className="site-card" key={category.value}>
              <h3><Link className="hover:text-[#c9ff55]" href={categoryHref(category.value)}>{category.label}</Link></h3>
              <p>{category.shortDescription}</p>
              <Link className="mt-4 inline-flex min-h-11 items-center text-sm text-[#c9ff55] underline underline-offset-4" href={categoryHref(category.value)}>Browse {category.label}</Link>
            </article>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="share-respectfully" title="Share a post, not a pressure campaign.">
        <p className="site-section__intro">After publishing, open the individual post and press Share. Your browser can open its share sheet or copy the link; you can also copy the page URL. Share that post with people who might genuinely care, so they can read the full context and choose for themselves.</p>
        <p className="site-section__intro">Before posting in another community, read its rules and disclose that the post is yours. Do not repeat the same pitch across unrelated threads, send unsolicited mass messages, manufacture likes, or pressure people to donate. Ask permission before resharing someone else’s request.</p>
        <p className="site-section__intro">Introducing the whole board instead? Use the public home link: <a className="break-all text-[#c9ff55] underline underline-offset-4" href="https://www.moneynerds.online/">https://www.moneynerds.online/</a>.</p>
      </GuideSection>

      <GuideSection id="help-without-funding" title="Support does not have to start with money.">
        <div className="site-bento">
          <article className="site-card"><h3>Ask a useful question</h3><p>Help an author clarify a missing detail. Discuss the request respectfully; do not demand sensitive documents in public comments.</p></article>
          <article className="site-card"><h3>Offer a relevant idea</h3><p>A practical suggestion, encouragement, or a thoughtful reply can help too. Do not turn someone else’s ask into an advertisement.</p></article>
          <article className="site-card"><h3>Flag a concern safely</h3><p>If something appears misleading or abusive, use the <Link className="text-[#c9ff55] underline underline-offset-4" href="/safety#report-a-problem">reporting contact</Link>. Share the public URL and your concern, not private information about the person.</p></article>
        </div>
      </GuideSection>
    </GuidePage>
  );
}
