"use client";

import type { ReactNode } from "react";
import { SolanaWalletProvider } from "@/components/providers/SolanaWalletProvider";

export function ClientProvider({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
