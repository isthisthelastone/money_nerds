"use client";

import { useI18n } from "@/components/providers/I18nProvider";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareButton({ path, title }: { path: string; title: string }) {
  const { t } = useI18n();
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
    <button className="post-action" type="button" onClick={() => void share()} aria-label={t("Share this post")}>
      {shared ? <Check aria-hidden="true" size={18} /> : <Share2 aria-hidden="true" size={18} />}
      <span>{shared ? t("Copied") : t("Share")}</span>
    </button>
  );
}
