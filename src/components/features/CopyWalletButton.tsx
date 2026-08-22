"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyWalletButton({
  walletAddress,
  label = "Copy wallet",
}: {
  walletAddress: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="button button-secondary"
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(walletAddress).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
      {copied ? "Copied" : label}
    </button>
  );
}
