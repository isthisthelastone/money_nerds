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
            endpoint='https://mainnet.helius-rpc.com/?api-key=d61f3621-9f97-44bd-a163-ed1a8ce47db9'>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};