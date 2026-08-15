"use client";

import { WalletModalButton } from "@solana/wallet-adapter-react-ui";
import { Check, ChevronDown, Copy, ExternalLink, LogOut, RefreshCw, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";

export function WalletControl() {
  const wallet = useWallet();
  const { session, status, authenticated, error, retrySignIn, disconnect } =
    useWalletSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const address = wallet.publicKey?.toBase58() ?? session?.walletAddress;

  if (!wallet.connected || !address) {
    return (
      <WalletModalButton className="mn-wallet-button">
        <Wallet aria-hidden="true" size={17} />
        Connect wallet
      </WalletModalButton>
    );
  }

  if (status === "signing" || status === "loading") {
    return (
      <button className="button button-secondary wallet-status" type="button" disabled>
        <RefreshCw className="spin" aria-hidden="true" size={17} />
        Sign to continue
      </button>
    );
  }

  if (!authenticated) {
    return (
      <div className="wallet-error-wrap">
        <button className="button button-accent" type="button" onClick={() => void retrySignIn()}>
          <RefreshCw aria-hidden="true" size={17} />
          Retry sign-in
        </button>
        {error ? <span className="sr-only">{error}</span> : null}
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="wallet-menu">
      <button
        className="wallet-trigger"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="wallet-dot" aria-hidden="true" />
        <span>{formatWallet(address)}</span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {open ? (
        <div className="wallet-popover" role="menu">
          <div className="wallet-popover-head">
            <span>Connected on Solana</span>
            <strong>{formatWallet(address, 6, 6)}</strong>
          </div>
          <Link role="menuitem" href={`/u/${address}`} onClick={() => setOpen(false)}>
            <ExternalLink aria-hidden="true" size={16} />
            Public profile
          </Link>
          <button role="menuitem" type="button" onClick={() => void copy()}>
            {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
            {copied ? "Copied" : "Copy address"}
          </button>
          <button role="menuitem" type="button" onClick={() => void disconnect()}>
            <LogOut aria-hidden="true" size={16} />
            Disconnect
          </button>
        </div>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Wallet address copied" : ""}
      </span>
    </div>
  );
}

