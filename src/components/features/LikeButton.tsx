"use client";

import { Heart, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const { authenticated, invalidateSession, session } = useWalletSession();
  const targetKey = `${targetType}:${targetId}`;
  const viewerWallet = session?.walletAddress ?? null;
  const [countOverride, setCountOverride] = useState<{
    targetKey: string;
    baseline: number;
    value: number;
  } | null>(null);
  const [likeState, setLikeState] = useState<{
    targetKey: string;
    walletAddress: string;
    value: boolean;
  } | null>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{ targetKey: string; value: string } | null>(null);
  const statusRequest = useRef<AbortController | null>(null);
  const toggleRequest = useRef<AbortController | null>(null);
  const statusVersion = useRef(0);
  const count =
    countOverride?.targetKey === targetKey && countOverride.baseline === initialCount
      ? countOverride.value
      : initialCount;
  const liked = Boolean(
    authenticated &&
      viewerWallet &&
      likeState?.targetKey === targetKey &&
      likeState.walletAddress === viewerWallet &&
      likeState.value,
  );
  const loading = pendingTarget === targetKey;
  const message = messageState?.targetKey === targetKey ? messageState.value : "";

  useEffect(() => {
    statusRequest.current?.abort();
    toggleRequest.current?.abort();
    const version = ++statusVersion.current;
    if (!authenticated || !viewerWallet) return;
    const controller = new AbortController();
    statusRequest.current = controller;
    void fetch(`/api/likes?targetType=${targetType}&targetId=${targetId}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { liked?: boolean } | null;
        if (!response.ok) return;
        if (!controller.signal.aborted && version === statusVersion.current) {
          setLikeState({
            targetKey,
            walletAddress: viewerWallet,
            value: Boolean(payload?.liked),
          });
        }
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (statusRequest.current === controller) statusRequest.current = null;
    };
  }, [authenticated, targetId, targetKey, targetType, viewerWallet]);

  useEffect(
    () => () => {
      statusRequest.current?.abort();
      toggleRequest.current?.abort();
    },
    [],
  );

  const shownLiked = liked;

  const toggle = async () => {
    if (!authenticated) {
      setMessageState({ targetKey, value: "Connect your wallet to react." });
      return;
    }
    if (loading) return;
    statusRequest.current?.abort();
    statusRequest.current = null;
    statusVersion.current += 1;
    const controller = new AbortController();
    toggleRequest.current = controller;
    setPendingTarget(targetKey);
    setMessageState(null);
    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId }),
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as {
        liked?: boolean;
        count?: number;
        error?: string;
      } | null;
      if (response.status === 401) {
        invalidateSession();
      }
      if (!response.ok) throw new Error(payload?.error ?? "Reaction failed.");
      if (!controller.signal.aborted && toggleRequest.current === controller) {
        if (viewerWallet) {
          setLikeState({
            targetKey,
            walletAddress: viewerWallet,
            value: Boolean(payload?.liked),
          });
        }
        if (Number.isFinite(payload?.count)) {
          setCountOverride({
            targetKey,
            baseline: initialCount,
            value: Number(payload?.count),
          });
        }
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setMessageState({
          targetKey,
          value: caught instanceof Error ? caught.message : "Reaction failed.",
        });
      }
    } finally {
      if (toggleRequest.current === controller) {
        toggleRequest.current = null;
        setPendingTarget(null);
      }
    }
  };

  return (
    <>
      <button
        className={`post-action ${shownLiked ? "active" : ""}`}
        type="button"
        onClick={() => void toggle()}
        aria-pressed={shownLiked}
        aria-busy={loading}
        aria-label={`${shownLiked ? "Unlike" : "Like"} ${targetType}. ${count} likes`}
        disabled={loading}
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
