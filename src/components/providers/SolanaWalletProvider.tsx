'use client'

import {WalletError} from '@solana/wallet-adapter-base'
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react'
import {FC, ReactNode, useCallback, useMemo} from 'react'
//import dynamic from 'next/dynamic'
// Import wallet styles
import '@solana/wallet-adapter-react-ui/styles.css'
import dynamic from 'next/dynamic';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

const WalletModalProvider = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletModalProvider),
    { ssr: false }
);

export interface WalletContextProviderProps {
    children: ReactNode
}

export const SolanaWalletProvider: FC<WalletContextProviderProps> = ({children}) => {
// Configure the network and endpoint

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

// Handle wallet errors
    const onError = useCallback((error: WalletError) => {
        console.error('Wallet Error:', error)
        // You can add more error handling here, like showing a toast notification
    }, [])

    return (
        <ConnectionProvider
            endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL as string}>
            <WalletProvider
                wallets={wallets}
                onError={onError}
                autoConnect={true}
            >
                <WalletModalProvider key={"original one"}>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}
