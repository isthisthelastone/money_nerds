"use client";
import React, {FC, ReactNode, useMemo} from 'react';
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react';
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui';
import {PhantomWalletAdapter} from '@solana/wallet-adapter-wallets';

import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
    children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({children}) => {
    const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

    return (
        <ConnectionProvider
            endpoint="https://methodical-proud-mound.solana-mainnet.quiknode.pro/cf7e2e60fb75f284ee97d657aa2078530eb291b0/">
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};