import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, MessageCircle, Radio } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyWalletButton } from "@/components/features/CopyWalletButton";
import { MediaGallery } from "@/components/features/MediaGallery";
import { PostCard } from "@/components/features/PostCard";
import { SITE_URL } from "@/lib/config";
import { getProfileActivity } from "@/lib/data";
import { formatRelativeTime, formatSol, formatWallet } from "@/lib/format";
import type { DonationRecord } from "@/lib/models";
import { normalizeWallet } from "@/lib/wallet";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ wallet: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const wallet = normalizeWallet((await params).wallet);
  if (!wallet) return { title: "Wallet not found" };
  const activity = await getProfileActivity(wallet);
  const name = activity?.profile.display_name || formatWallet(wallet, 6, 6);
  return {
    title: `${name} — public wallet profile`,
    description: `Posts, comments, and verified Solana support connected to ${formatWallet(wallet, 8, 8)} on Money Nerds.`,
    alternates: { canonical: `/u/${wallet}` },
    openGraph: {
      type: "profile",
      url: `${SITE_URL}/u/${wallet}`,
      title: `${name} on Money Nerds`,
      images: [{ url: "/og.png", width: 1733, height: 907 }],
    },
  };
}

export default async function WalletProfilePage({ params }: { params: RouteParams }) {
  const wallet = normalizeWallet((await params).wallet);
  if (!wallet) notFound();
  const activity = await getProfileActivity(wallet);
  if (!activity) notFound();

  const aliases = Array.from(
    new Set([
      activity.profile.display_name,
      ...activity.posts.map((post) => post.nickname),
      ...activity.comments.map((comment) => comment.nickname),
    ].filter(Boolean)),
  ) as string[];
  const sentLamports = activity.sent.reduce((sum, donation) => sum + Number(donation.lamports), 0);
  const receivedLamports = activity.received.reduce((sum, donation) => sum + Number(donation.lamports), 0);
  const displayName = activity.profile.display_name || aliases[0] || "Anonymous nerd";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: `${SITE_URL}/u/${wallet}`,
    dateCreated: activity.profile.created_at,
    mainEntity: {
      "@type": "Person",
      name: displayName,
      identifier: wallet,
      description: activity.profile.bio || "A public Money Nerds wallet profile.",
    },
  };

  return (
    <main className="site-shell pb-20 pt-10 sm:pt-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#111311]">
        <div className="border-b border-white/8 bg-[radial-gradient(circle_at_80%_0%,rgba(201,255,85,.16),transparent_38%)] p-6 sm:p-9">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
            <Radio aria-hidden="true" size={14} /> Public wallet identity
          </p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-[#f2efe6] sm:text-5xl">{displayName}</h1>
              <p className="mt-3 break-all font-mono text-xs text-white/45 sm:text-sm">{wallet}</p>
              {activity.profile.bio ? <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60">{activity.profile.bio}</p> : null}
            </div>
            <CopyWalletButton walletAddress={wallet} />
          </div>
          {aliases.length ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/40">
              <span>Posted as</span>
              {aliases.map((alias) => <span key={alias} className="rounded-full border border-white/10 px-2.5 py-1 text-white/65">{alias}</span>)}
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 divide-x divide-y divide-white/8 sm:grid-cols-4 sm:divide-y-0">
          <div className="p-5"><dt className="text-xs text-white/40">Posts</dt><dd className="mt-2 text-2xl font-semibold text-[#f2efe6]">{activity.posts.length}</dd></div>
          <div className="p-5"><dt className="text-xs text-white/40">Comments</dt><dd className="mt-2 text-2xl font-semibold text-[#f2efe6]">{activity.comments.length}</dd></div>
          <div className="p-5"><dt className="text-xs text-white/40">Verified sent</dt><dd className="mt-2 text-xl font-semibold text-[#f2efe6]">{formatSol(sentLamports)} SOL</dd></div>
          <div className="p-5"><dt className="text-xs text-white/40">Verified received</dt><dd className="mt-2 text-xl font-semibold text-[#c9ff55]">{formatSol(receivedLamports)} SOL</dd></div>
        </dl>
      </section>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="wallet-posts-title">
          <h2 className="text-2xl font-semibold tracking-tight text-[#f2efe6]" id="wallet-posts-title">Posts</h2>
          <div className="mt-4 grid gap-5">
            {activity.posts.map((post) => <PostCard key={post.id} post={post} />)}
            {!activity.posts.length ? <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">No posts from this wallet yet.</p> : null}
          </div>
        </section>

        <aside className="grid gap-6 lg:sticky lg:top-24">
          <section className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5" aria-labelledby="wallet-comments-title">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#f2efe6]" id="wallet-comments-title"><MessageCircle aria-hidden="true" size={18} /> Recent comments</h2>
            <div className="mt-4 grid gap-3">
              {activity.comments.slice(0, 12).map((comment) => (
                <article key={comment.id} className="border-t border-white/8 pt-3 first:border-0 first:pt-0">
                  <Link className="line-clamp-3 text-sm leading-6 text-white/65 hover:text-white" href={`/p/${comment.post_id}`}>
                    {comment.body || "Media comment"}
                  </Link>
                  <p className="mt-1 text-[0.68rem] text-white/35" suppressHydrationWarning>{formatRelativeTime(comment.created_at)} · Post #{comment.post_id}</p>
                  <MediaGallery media={comment.media} />
                </article>
              ))}
              {!activity.comments.length ? <p className="text-sm text-white/40">No comments yet.</p> : null}
            </div>
          </section>

          <DonationLedger title="Verified sent" direction="sent" donations={activity.sent} />
          <DonationLedger title="Verified received" direction="received" donations={activity.received} />
        </aside>
      </div>
    </main>
  );
}

function DonationLedger({
  title,
  direction,
  donations,
}: {
  title: string;
  direction: "sent" | "received";
  donations: DonationRecord[];
}) {
  const Icon = direction === "sent" ? ArrowUpRight : ArrowDownLeft;
  return (
    <section className="rounded-[1.4rem] border border-white/10 bg-[#111311] p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[#f2efe6]"><Icon aria-hidden="true" size={18} /> {title}</h2>
      <div className="mt-4 grid gap-3">
        {donations.slice(0, 12).map((donation) => (
          <a key={donation.signature} className="flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-sm first:border-0 first:pt-0" href={`https://solscan.io/tx/${donation.signature}`} target="_blank" rel="noreferrer">
            <span><strong className="font-medium text-white/75">{formatSol(Number(donation.lamports))} SOL</strong><small className="mt-1 block font-mono text-[0.65rem] text-white/30">{formatWallet(donation.signature, 5, 5)}</small></span>
            <ExternalLink className="text-[#9ccaff]" aria-hidden="true" size={14} />
          </a>
        ))}
        {!donations.length ? <p className="text-sm text-white/40">No verified transfers yet.</p> : null}
      </div>
    </section>
  );
}
