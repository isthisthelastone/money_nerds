"use client"
import {FC, ReactNode, useMemo} from 'react'
import {WalletAdapterNetwork} from '@solana/wallet-adapter-base'
import {ConnectionProvider, WalletProvider as SolanaWalletProvider} from '@solana/wallet-adapter-react'
import {WalletModalProvider} from '@solana/wallet-adapter-react-ui'
import {clusterApiUrl} from '@solana/web3.js'

// Import wallet adapter CSS

interface WalletProviderProps {
    children: ReactNode
}

export const WalletProvider: FC<WalletProviderProps> = ({children}) => {
    // Set to 'mainnet-beta' for production
    const network = WalletAdapterNetwork.Devnet
    const endpoint = useMemo(() => clusterApiUrl(network), [network])

    const wallets = useMemo(() => [], [])

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    )
}

