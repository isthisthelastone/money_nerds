"use client";

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";
import { WalletAdapterNetwork, type WalletError } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { getSolanaRpcUrl } from "@/lib/config";

import "@solana/wallet-adapter-react-ui/styles.css";

let metaMaskInitialization: Promise<void> | null = null;

function ensureMetaMaskWalletRegistered() {
  if (metaMaskInitialization) return metaMaskInitialization;

  const initialization = import("@metamask/connect-solana")
    .then(async ({ createSolanaClient }) => {
      const client = await createSolanaClient({
        dapp: {
          name: "Money Nerds",
          url: window.location.origin,
          iconUrl: new URL("/icon.svg", window.location.origin).href,
        },
        api: {
          supportedNetworks: { mainnet: getSolanaRpcUrl() },
        },
        analytics: { enabled: false },
        skipAutoRegister: true,
      });
      await client.registerWallet();
    })
    .catch((error: unknown) => {
      if (metaMaskInitialization === initialization) metaMaskInitialization = null;
      throw error;
    });
  metaMaskInitialization = initialization;
  return initialization;
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let active = true;

    // MetaMask's Solana client registers a Wallet Standard wallet. Wallet Adapter
    // observes that registry, so the same wallet/session UI works for the extension,
    // mobile deeplinks, and restored relay sessions without an EVM-only provider.
    // Keep one initialization promise across React Strict Mode's effect remount.
    // The client must outlive an ordinary component cleanup to retain its relay
    // session and avoid accumulating duplicate SDK listeners.
    void ensureMetaMaskWalletRegistered()
      .catch((error: unknown) => {
        if (active) console.error("MetaMask Solana connection could not be initialized", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: "Money Nerds",
          uri: "https://www.moneynerds.online",
          icon: "icon.svg",
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: WalletAdapterNetwork.Mainnet,
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    [],
  );
  const onError = useCallback((error: WalletError) => {
    console.error("Solana wallet error", error);
  }, []);

  return (
    <ConnectionProvider endpoint={getSolanaRpcUrl()}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
