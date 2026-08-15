"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";

export function LikeButton({
  targetType,
  targetId,
  initialCount,
}: {
  targetType: "post" | "comment";
  targetId: number;
  initialCount: number;
}) {
  const { authenticated } = useWalletSession();
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void fetch(`/api/likes?targetType=${targetType}&targetId=${targetId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload: { liked?: boolean }) => setLiked(Boolean(payload.liked)))
      .catch(() => undefined);
    return () => controller.abort();
  }, [authenticated, targetId, targetType]);

  const shownLiked = authenticated && liked;

  const toggle = async () => {
    if (!authenticated) {
      setMessage("Connect your wallet to react.");
      return;
    }
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
      });
      const payload = (await response.json()) as { liked?: boolean; count?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Reaction failed.");
      setLiked(Boolean(payload.liked));
      if (Number.isFinite(payload.count)) setCount(Number(payload.count));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Reaction failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className={`post-action ${shownLiked ? "active" : ""}`}
        type="button"
        onClick={() => void toggle()}
        aria-pressed={shownLiked}
        aria-label={`${shownLiked ? "Unlike" : "Like"} ${targetType}. ${count} likes`}
      >
        {loading ? (
          <LoaderCircle className="spin" aria-hidden="true" size={18} />
        ) : (
          <Heart aria-hidden="true" size={18} fill={shownLiked ? "currentColor" : "none"} />
        )}
        <span>{count}</span>
      </button>
      {message ? <span className="sr-only" role="status">{message}</span> : null}
    </>
  );
}
