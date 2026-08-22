"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { CommentsPanel } from "@/components/features/CommentsPanel";
import { DonateButton } from "@/components/features/DonateButton";
import { LikeButton } from "@/components/features/LikeButton";
import { MediaGallery } from "@/components/features/MediaGallery";
import { ShareButton } from "@/components/features/ShareButton";
import { categoryHref } from "@/lib/categories";
import { formatRelativeTime, formatSol, formatWallet } from "@/lib/format";
import { CATEGORY_LABELS, isCategory, type CommentCardData, type PostCardData } from "@/lib/models";

export function PostCard({
  post,
  detail = false,
  initialComments,
}: {
  post: PostCardData;
  detail?: boolean;
  initialComments?: CommentCardData[];
}) {
  const totalLikes = post.like_count + post.legacy_like_count;
  const postCategory = isCategory(post.category) ? post.category : "anything";
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#111311] shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
      <div className="p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/40">
              <a
                className="rounded-full bg-[#c9ff55]/10 px-2.5 py-1 font-medium text-[#c9ff55] transition hover:bg-[#c9ff55]/20"
                href={categoryHref(postCategory)}
              >
                {CATEGORY_LABELS[postCategory]}
              </a>
              <span>#{post.id}</span>
              <time dateTime={post.created_at} suppressHydrationWarning>
                {formatRelativeTime(post.created_at)}
              </time>
            </div>
            <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link className="text-base font-semibold text-[#f2efe6] transition hover:text-[#c9ff55]" href={`/u/${post.author_wallet}`}>
                {post.nickname}
              </Link>
              <span className="font-mono text-xs text-white/35">{formatWallet(post.author_wallet, 5, 5)}</span>
            </div>
          </div>
          {!detail ? (
            <Link className="rounded-full p-2 text-white/35 transition hover:bg-white/6 hover:text-white" href={`/p/${post.id}`} aria-label={`Open post ${post.id}`}>
              <ExternalLink aria-hidden="true" size={18} />
            </Link>
          ) : null}
        </header>
        {post.body ? (
          <p className={`${detail ? "text-lg sm:text-xl" : "text-[1.02rem]"} mt-5 whitespace-pre-wrap leading-7 text-[#e8e5dc]`}>
            {post.body}
          </p>
        ) : null}
        <MediaGallery media={post.media} />
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-white/8 py-3 text-xs text-white/45">
          <span>
            <strong className="font-semibold text-white/75">{formatSol(post.verified_donation_lamports)} SOL</strong> verified funding
          </span>
          {post.legacy_donation_lamports ? (
            <span title="Imported from the original app without an available transaction signature">
              +{formatSol(post.legacy_donation_lamports)} SOL legacy record
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <MessageCircle aria-hidden="true" size={14} /> {post.comment_count}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <LikeButton targetType="post" targetId={post.id} initialCount={totalLikes} />
          <DonateButton recipientAddress={post.author_wallet} targetType="post" targetId={post.id} />
          <ShareButton path={`/p/${post.id}`} title={`${post.nickname} on Money Nerds`} />
        </div>
      </div>
      <div className="px-5 sm:px-6">
        <CommentsPanel
          postId={post.id}
          initialCount={post.comment_count}
          initialComments={initialComments}
          defaultOpen={detail}
        />
      </div>
    </article>
  );
}
