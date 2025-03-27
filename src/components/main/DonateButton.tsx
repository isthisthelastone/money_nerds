"use client";

import React, {FC, useMemo, useState} from 'react';
import {ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction,} from '@solana/web3.js';
import {useConnection, useWallet} from '@solana/wallet-adapter-react';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';

interface DonateButtonProps {
    recipientAddress: string;
}

const UnwrappedDonateButton: React.FC<DonateButtonProps> = ({recipientAddress}) => {
    const [amount, setAmount] = useState('');
    const [status, setStatus] = useState('');
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {connection} = useConnection();
    const {publicKey, sendTransaction, connected} = useWallet();

    const recipientPubKey = useMemo(() => new PublicKey(recipientAddress), [recipientAddress]);

    const calculatePriorityFee = async () => {
        try {
            const fees = await connection.getRecentPrioritizationFees();
            if (!fees.length) return 100_000_000; // Increased to 0.002 SOL for priority

            const averageFee = fees.reduce((sum, fee) => sum + fee.prioritizationFee, 0) / fees.length;
            return Math.ceil(averageFee * 100); // Increased priority (2x)
            //eslint-disable-next-line
        } catch (error) {
            console.warn("Using fallback priority fee");
            return 100_000_000; // Increased fallback fee
        }
    };

    const handleDonate = async () => {
        if (!publicKey || !amount || parseFloat(amount) <= 0) {
            setIsError(true);
            setStatus('Enter a valid amount.');
            return;
        }

        setIsLoading(true);
        setStatus('');
        setIsError(false);

        try {
            const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
            const priorityFee = await calculatePriorityFee();

            // Only build the transaction initially without blockhash
            const transaction = new Transaction();
            transaction.feePayer = publicKey;

            transaction.add(
                ComputeBudgetProgram.setComputeUnitLimit({units: 1_400_000}),
                ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}),
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: recipientPubKey,
                    lamports,
                })
            );

            // Fetch freshest blockhash exactly right before signature and send
            const latestBlockhash = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = latestBlockhash.blockhash;

            // Immediately send transaction (minimize delay!)
            const signature = await sendTransaction(transaction, connection, {
                preflightCommitment: 'confirmed',
                skipPreflight: false,
                maxRetries: 5,
            });

            // Confirm the transaction robustly
            const confirmation = await connection.confirmTransaction(
                {
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                },
                'finalized'
            );

            if (confirmation.value.err) {
                throw new Error('Transaction failed during confirmation.');
            }

            setStatus(`✅ Donation successful! Signature: ${signature}`);
            setAmount('');
            //eslint-disable-next-line
        } catch (error: any) {
            console.error('Donation error:', error);
            setStatus(
                //eslint-disable-next-line
                error.message.includes('expired') ||
                //eslint-disable-next-line
                error.message.includes('block height') ||
                //eslint-disable-next-line
                error.message.includes('Blockhash not found')
                    ? '⏳ Transaction expired. Please retry quickly and confirm immediately.'
                    //eslint-disable-next-line
                    : `❌ Error: ${error.message}`
            );
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (!connected) {
        return (
            <div>
                <p className="text-gray-500 mb-3">Please connect your wallet first.</p>
                <WalletMultiButton style={{backgroundColor: '#3377ff'}}/>
            </div>
        );
    }

    return (
        <div>
            <WalletMultiButton/>
            <div className="flex gap-2 my-3">
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="SOL amount"
                    className="bg-[#1a1a1a] border border-[#333] rounded text-white px-3 py-2 w-[120px] focus:outline-none focus:border-[#666]"
                />
                <button
                    //eslint-disable-next-line
                    onClick={handleDonate}
                    disabled={!publicKey || isLoading || parseFloat(amount) <= 0}
                    className="bg-[#512da8] text-white rounded px-4 py-2 cursor-pointer transition-colors duration-200 hover:bg-[#673ab7] disabled:bg-[#333] disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Processing...' : 'Donate'}
                </button>
            </div>
            {status && (
                <div className={`text-sm mt-2 ${isError ? 'text-[#ff4444]' : 'text-[#4caf50]'}`}>
                    {status}
                </div>
            )}
        </div>
    );
};

export const DonateButton: FC<DonateButtonProps> = (props) => {
    return <UnwrappedDonateButton {...props} />;
};