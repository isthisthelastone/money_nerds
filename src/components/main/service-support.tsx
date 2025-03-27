"use client";
import {useState} from 'react';
import {useConnection, useWallet} from '@solana/wallet-adapter-react';
import {LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';
import {twMerge} from "tailwind-merge";

const MY_WALLET_ADDRESS = 'BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg';

interface ServiceButtonProps {
    buttonClassName?: string;
}

export const ServiceDonateButton = ({buttonClassName}: ServiceButtonProps) => {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const {connection} = useConnection();
    const {publicKey, sendTransaction} = useWallet();

    const handleDonate = async () => {
        if (!amount || !publicKey) return;
        setLoading(true);

        try {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(MY_WALLET_ADDRESS),
                    lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
                })
            );

            const signature = await sendTransaction(transaction, connection);
            const latestBlockhash = (await connection.getLatestBlockhash()).blockhash;
            const {lastValidBlockHeight} = await connection.getLatestBlockhash();

// After sending your transaction and getting the "signature":
            await connection.confirmTransaction(
                {
                    blockhash: latestBlockhash,
                    lastValidBlockHeight,
                    signature
                },
                'confirmed' // or 'finalized', 'processed', etc.
            );

            setStatus('Donation successful! Thanks!');
            setAmount('');
            //eslint-disable-next-line
        } catch (error) {
            setStatus('Donation failed. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={twMerge(buttonClassName, 'flex flex-col gap-2')}>
            <WalletMultiButton style={{
                marginLeft: '8.5rem'
            }}/>
            <div className="flex gap-2 my-3 justify-between px-3">
                <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="SOL amount"
                    className="bg-[#1a1a1a] border border-[#333] rounded text-white px-3 py-2 w-[120px] focus:outline-none"
                />
                <button
                    //eslint-disable-next-line
                    onClick={handleDonate}
                    disabled={!amount || loading}
                    className="bg-[#512da8] text-white rounded px-4 py-2 hover:bg-[#673ab7] disabled:bg-[#333] disabled:cursor-not-allowed"
                >
                    {loading ? 'Processing...' : 'Donate'}
                </button>
            </div>
            {status && <p className="text-sm mt-2 text-gray-300">{status}</p>}
        </div>
    );
};
