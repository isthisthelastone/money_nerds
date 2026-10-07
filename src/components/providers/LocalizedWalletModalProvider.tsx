"use client";
import Image from "next/image";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "./I18nProvider";

/** Same Wallet Adapter selection contract, with localised copy and native focus trapping. */
export function LocalizedWalletModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ visible, setVisible }), [visible]);
  const { wallets, select } = useWallet();
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (visible && !element.open) element.showModal();
    if (!visible && element.open) element.close();
    if (!visible) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [visible]);
  const available = wallets.filter(wallet => wallet.readyState !== WalletReadyState.Unsupported);
  return <WalletModalContext.Provider value={value}>
    {children}
    {visible ? <dialog ref={dialog} className="localized-wallet-dialog" aria-labelledby="wallet-choice-heading" onCancel={() => setVisible(false)} onClose={() => setVisible(false)} onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) setVisible(false);
    }}>
      <div className="flex items-start justify-between gap-4"><h2 id="wallet-choice-heading" className="text-xl font-semibold">{t("Connect a wallet on Solana to continue")}</h2><button type="button" className="button button-secondary" onClick={() => setVisible(false)} aria-label={t("Close")}>×</button></div>
      <ul className="mt-5 grid gap-2">{available.map(wallet => <li key={wallet.adapter.name}><button className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/15 px-4 py-3 text-left hover:border-[#c9ff55]" type="button" onClick={() => { select(wallet.adapter.name); setVisible(false); }}>
        <Image src={wallet.adapter.icon} alt="" width={28} height={28} unoptimized />
        <span>{wallet.adapter.name}</span>
        {wallet.readyState === WalletReadyState.Installed ? <small className="ml-auto text-[#c9ff55]">{t("Detected")}</small> : null}
      </button></li>)}</ul>
      {!available.length ? <p className="mt-4 text-white/65">{t("No compatible wallet is available on this device.")}</p> : null}
    </dialog> : null}
  </WalletModalContext.Provider>;
}
