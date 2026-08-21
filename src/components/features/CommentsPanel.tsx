"use client";

import { ChevronDown, LoaderCircle, MessageCircle, Reply } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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

const COMMENT_PAGE_SIZES = [10, 25, 50, 100] as const;

interface CommentsResponse {
  comments?: CommentCardData[];
  hasMore?: boolean;
  nextCursor?: number;
  error?: string;
}

export function CommentsPanel({
  postId,
  initialCount,
  initialComments,
  defaultOpen = false,
}: CommentsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<CommentCardData[]>(initialComments ?? []);
  const [optimisticCount, setOptimisticCount] = useState(initialCount);
  const [pageSize, setPageSize] = useState(25);
  const [cursor, setCursor] = useState(initialComments?.at(-1)?.id ?? 0);
  const [hasMore, setHasMore] = useState((initialComments?.length ?? 0) < initialCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(Boolean(initialComments));
  const requestVersion = useRef(0);
  const commentsRef = useRef(initialComments ?? []);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const commentCount = Math.max(initialCount, optimisticCount);

  const load = async ({
    reset = false,
    size = pageSize,
  }: { reset?: boolean; size?: number } = {}) => {
    const version = ++requestVersion.current;
    const activeCursor = reset ? 0 : cursor;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        postId: String(postId),
        afterId: String(activeCursor),
        pageSize: String(size),
      });
      const response = await fetch(`/api/comments?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as CommentsResponse;
      if (!response.ok) throw new Error(payload.error ?? "Comments could not be loaded.");
      if (version !== requestVersion.current) return;
      const nextComments = payload.comments ?? [];
      setComments((current) => {
        if (reset) {
          commentsRef.current = nextComments;
          return nextComments;
        }
        const byId = new Map(current.map((comment) => [comment.id, comment]));
        nextComments.forEach((comment) => byId.set(comment.id, comment));
        const merged = [...byId.values()].sort((left, right) => left.id - right.id);
        commentsRef.current = merged;
        return merged;
      });
      setCursor(Number(payload.nextCursor ?? activeCursor));
      setHasMore(Boolean(payload.hasMore));
      setLoaded(true);
    } catch (caught) {
      if (version !== requestVersion.current) return;
      setError(caught instanceof Error ? caught.message : "Comments could not be loaded.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  };

  const loadPublished = async (commentId: number) => {
    try {
      const params = new URLSearchParams({
        postId: String(postId),
        afterId: String(Math.max(0, commentId - 1)),
        pageSize: "10",
      });
      const response = await fetch(`/api/comments?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as CommentsResponse;
      if (!response.ok) throw new Error(payload.error ?? "The new comment could not be loaded.");
      const published = payload.comments?.find((comment) => comment.id === commentId);
      if (!published) return;
      if (commentsRef.current.some((comment) => comment.id === published.id)) return;
      const nextComments = [...commentsRef.current, published].sort(
        (left, right) => left.id - right.id,
      );
      commentsRef.current = nextComments;
      setComments(nextComments);
      setOptimisticCount((count) => Math.max(count, initialCount) + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The new comment could not be loaded.");
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded && !loading) void load({ reset: true });
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
          {commentCount === 1 ? "1 comment" : `${commentCount} comments`}
        </span>
        <ChevronDown className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true" size={17} />
      </button>
      {open ? (
        <div className="pb-5">
          {loading && !loaded ? (
            <p className="flex items-center gap-2 py-5 text-sm text-white/45">
              <LoaderCircle className="spin" aria-hidden="true" size={17} /> Loading thread
            </p>
          ) : null}
          {error ? <p className="py-4 text-sm text-[#ff8066]">{error}</p> : null}
          {loaded || (!loading && !error) ? (
            <div className="grid gap-3">
              {roots.map((comment) => (
                <CommentBranch
                  key={comment.id}
                  comment={comment}
                  allComments={comments}
                  postId={postId}
                  onReplyPublished={(id) => void loadPublished(id)}
                />
              ))}
              {!comments.length ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/40">
                  No comments yet. Be the first useful stranger.
                </p>
              ) : null}
            </div>
          ) : null}
          {loaded && (comments.length > 0 || hasMore) ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
              <p className="text-xs text-white/40">
                Showing {comments.length} of {commentCount}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-white/45">
                  Page size
                  <select
                    className="rounded-lg border border-white/10 bg-[#151815] px-2 py-1.5 text-xs text-white outline-none focus:border-[#c9ff55]/60"
                    value={pageSize}
                    onChange={(event) => {
                      const nextSize = Number(event.target.value);
                      setPageSize(nextSize);
                      setCursor(0);
                      setHasMore(commentCount > 0);
                      void load({ reset: true, size: nextSize });
                    }}
                    disabled={loading}
                  >
                    {COMMENT_PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
                {hasMore ? (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    {loading ? <LoaderCircle className="spin" aria-hidden="true" size={16} /> : null}
                    Load more
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="mt-4">
            <Composer mode="comment" postId={postId} compact onPublished={(id) => void loadPublished(id)} />
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
  onReplyPublished: (id: number) => void;
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
            onPublished={(id) => {
              setReplying(false);
              onReplyPublished(id);
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
