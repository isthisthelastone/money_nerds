'use client'

import {WalletAdapterNetwork, WalletError} from '@solana/wallet-adapter-base'
import {ConnectionProvider, WalletProvider} from '@solana/wallet-adapter-react'
import {clusterApiUrl} from '@solana/web3.js'
import {FC, ReactNode, useCallback, useMemo} from 'react'
import dynamic from 'next/dynamic'
// Import wallet styles
import '@solana/wallet-adapter-react-ui/styles.css'

// Dynamically import WalletModalProvider to handle SSR
const WalletModalProvider = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletModalProvider),
    {
        ssr: false,
        loading: () => <div>Loading wallet...</div>
    }
)

export interface WalletContextProviderProps {
    children: ReactNode
}

export const SolanaWalletProvider: FC<WalletContextProviderProps> = ({children}) => {
// Configure the network and endpoint
    const network = WalletAdapterNetwork.Devnet
    const endpoint = useMemo(() => clusterApiUrl(network), [network])

// Empty wallets array since we're using standard wallet adapters
    const wallets = useMemo(
        () => [],
        []
    )

// Handle wallet errors
    const onError = useCallback((error: WalletError) => {
        console.error('Wallet Error:', error)
        // You can add more error handling here, like showing a toast notification
    }, [])

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider
                wallets={wallets}
                onError={onError}
                autoConnect={true}
            >
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    )
}
