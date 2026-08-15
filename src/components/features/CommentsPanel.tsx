"use client";

import { ChevronDown, LoaderCircle, MessageCircle, Reply } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Composer } from "@/components/features/Composer";
import { DonateButton } from "@/components/features/DonateButton";
import { LikeButton } from "@/components/features/LikeButton";
import { MediaGallery } from "@/components/features/MediaGallery";
import { formatRelativeTime, formatSol, formatWallet } from "@/lib/format";
import type { CommentCardData } from "@/lib/models";

interface CommentsPanelProps {
  postId: number;
  initialCount: number;
  initialComments?: CommentCardData[];
  defaultOpen?: boolean;
}

export function CommentsPanel({
  postId,
  initialCount,
  initialComments,
  defaultOpen = false,
}: CommentsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<CommentCardData[]>(initialComments ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(Boolean(initialComments));

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/comments?postId=${postId}`, { cache: "no-store" });
      const payload = (await response.json()) as { comments?: CommentCardData[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Comments could not be loaded.");
      setComments(payload.comments ?? []);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Comments could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load();
  };

  const roots = useMemo(() => comments.filter((comment) => !comment.parent_id), [comments]);

  return (
    <div className="border-t border-white/8">
      <button
        className="flex w-full items-center justify-between gap-3 py-4 text-sm text-white/60 transition hover:text-white"
        type="button"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <MessageCircle aria-hidden="true" size={18} />
          {initialCount === 1 ? "1 comment" : `${initialCount} comments`}
        </span>
        <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" size={17} />
      </button>
      {open ? (
        <div className="pb-5">
          {loading ? (
            <p className="flex items-center gap-2 py-5 text-sm text-white/45">
              <LoaderCircle className="spin" aria-hidden="true" size={17} /> Loading thread
            </p>
          ) : null}
          {error ? <p className="py-4 text-sm text-[#ff8066]">{error}</p> : null}
          {!loading && !error ? (
            <div className="grid gap-3">
              {roots.map((comment) => (
                <CommentBranch
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  postId={postId}
                  onReplyPublished={() => void load()}
                />
              ))}
              {!comments.length ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">
                  No comments yet. Be the first useful stranger.
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4">
            <Composer mode="comment" postId={postId} compact onPublished={() => void load()} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommentBranch({
  comment,
  allComments,
  postId,
  onReplyPublished,
  depth = 0,
}: {
  comment: CommentCardData;
  allComments: CommentCardData[];
  postId: number;
  onReplyPublished: () => void;
  depth?: number;
}) {
  const [replying, setReplying] = useState(false);
  const children = allComments.filter((candidate) => candidate.parent_id === comment.id);
  const authorLabel = comment.nickname || comment.legacy_author_label || "Anonymous nerd";

  return (
    <div className={depth ? "ml-3 border-l border-white/10 pl-3 sm:ml-7 sm:pl-5" : ""}>
      <article className="rounded-xl border border-white/8 bg-black/18 p-4">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
          {comment.author_wallet ? (
            <Link className="font-medium text-white/75 hover:text-[#c9ff55]" href={`/u/${comment.author_wallet}`}>
              {authorLabel}
            </Link>
          ) : (
            <strong className="font-medium text-white/65">{authorLabel}</strong>
          )}
          {comment.author_wallet ? <span className="font-mono">{formatWallet(comment.author_wallet)}</span> : null}
          <span aria-hidden="true">·</span>
          <time dateTime={comment.created_at} suppressHydrationWarning>
            {formatRelativeTime(comment.created_at)}
          </time>
        </header>
        {comment.body ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/75">{comment.body}</p> : null}
        <MediaGallery media={comment.media} />
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <LikeButton targetType="comment" targetId={comment.id} initialCount={comment.like_count} />
          {comment.author_wallet ? (
            <DonateButton
              recipientAddress={comment.author_wallet}
              targetType="comment"
              targetId={comment.id}
              label={comment.verified_donation_lamports ? `${formatSol(comment.verified_donation_lamports)} SOL` : "Fund"}
            />
          ) : null}
          <button className="post-action" type="button" onClick={() => setReplying((value) => !value)}>
            <Reply aria-hidden="true" size={17} /> Reply
          </button>
        </div>
      </article>
      {replying ? (
        <div className="mt-2">
          <Composer
            mode="comment"
            postId={postId}
            parentId={comment.id}
            compact
            onCancel={() => setReplying(false)}
            onPublished={() => {
              setReplying(false);
              onReplyPublished();
            }}
          />
        </div>
      ) : null}
      {children.length ? (
        <div className="mt-2 grid gap-2">
          {children.map((child) => (
            <CommentBranch
              key={child.id}
              comment={child}
              allComments={allComments}
              postId={postId}
              onReplyPublished={onReplyPublished}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

