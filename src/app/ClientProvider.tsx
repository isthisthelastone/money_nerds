"use client";

import type { ReactNode } from "react";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";
import { WalletSessionProvider } from "@/components/providers/WalletSessionProvider";

export function ClientProvider({ children }: { children: ReactNode }) {
  return (
    <WalletSessionProvider>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </WalletSessionProvider>
  );
}
