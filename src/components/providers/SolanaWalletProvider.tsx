"use client";

import type { WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { type ReactNode, useCallback, useMemo } from "react";
import { getSolanaRpcUrl } from "@/lib/config";
import { WalletSessionProvider } from "@/components/providers/WalletSessionProvider";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );
  const onError = useCallback((error: WalletError) => {
    console.error("Solana wallet error", error);
  }, []);

  return (
    <ConnectionProvider endpoint={getSolanaRpcUrl()}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>
          <WalletSessionProvider>{children}</WalletSessionProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
