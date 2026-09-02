"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
  Check,
  ChevronDown,
  Copy,
  LogOut,
  RefreshCw,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";
import { IDENTITY_PROVIDER_LABELS } from "@/lib/models";

function signInUrl() {
  if (typeof window === "undefined") return "/sign-in";
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
}

export function WalletControl() {
  const { isLoaded, isSignedIn, user } = useUser();
  const clerk = useClerk();
  const { session, status, authenticated, error, retrySignIn, disconnect } = useWalletSession();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const copy = async () => {
    if (!session?.walletAddress) return;
    await navigator.clipboard.writeText(session.walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  };

  if (!isLoaded || status === "loading" || (isSignedIn && status === "preparing")) {
    return (
      <button className="button button-secondary wallet-status" type="button" disabled>
        <RefreshCw className="spin" aria-hidden="true" size={17} />
        {isSignedIn ? "Preparing profile" : "Checking session"}
      </button>
    );
  }

  if (!isSignedIn) {
    return (
      <button
        className="mn-wallet-button"
        type="button"
        onClick={() => window.location.assign(signInUrl())}
      >
        <UserRound aria-hidden="true" size={17} />
        Sign in
      </button>
    );
  }

  if (!authenticated || !session) {
    return (
      <div className="wallet-error-wrap">
        <button className="button button-accent" type="button" onClick={() => void retrySignIn()}>
          <RefreshCw aria-hidden="true" size={17} />
          Retry profile
        </button>
        {error ? (
          <span className="wallet-error-message" role="status" aria-live="polite">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  const providerLabel = session.authProvider === "wallet"
    ? "Web3"
    : IDENTITY_PROVIDER_LABELS[session.authProvider];
  const profileLabel =
    session.profile?.display_name?.trim() ||
    user?.fullName?.trim() ||
    user?.username?.trim() ||
    "Money Nerd";

  return (
    <div ref={menuRef} className="wallet-menu">
      <button
        className="wallet-trigger external-identity-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound aria-hidden="true" size={17} />
        <span>{profileLabel}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {open ? (
        <div className="wallet-popover" role="menu">
          <div className="wallet-popover-head">
            <span>Signed in with {providerLabel}</span>
            <strong>{profileLabel}</strong>
            <small>Profile {formatWallet(session.walletAddress, 5, 5)}</small>
          </div>
          <Link
            role="menuitem"
            href={`/u/${session.walletAddress}`}
            onClick={() => setOpen(false)}
          >
            <UserRound aria-hidden="true" size={16} />
            Public profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              clerk.openUserProfile();
            }}
          >
            <Settings aria-hidden="true" size={16} />
            Account settings
          </button>
          <button role="menuitem" type="button" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            {copied ? "Copied" : "Copy profile ID"}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              void disconnect();
            }}
          >
            <LogOut aria-hidden="true" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Profile ID copied" : ""}
      </span>
    </div>
  );
}
