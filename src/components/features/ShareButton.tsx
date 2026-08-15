"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButton({ path, title }: { path: string; title: string }) {
  const [shared, setShared] = useState(false);
  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1600);
    } catch {
      // Native share sheets reject when the user closes them; no error UI is needed.
    }
  };
  return (
    <button className="post-action" type="button" onClick={() => void share()} aria-label="Share this post">
      {shared ? <Check aria-hidden="true" size={18} /> : <Share2 aria-hidden="true" size={18} />}
      <span>{shared ? "Copied" : "Share"}</span>
    </button>
  );
}

