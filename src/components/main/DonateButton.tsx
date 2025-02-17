"use client";
import {FC, useState} from 'react';
import {useConnection, useWallet} from '@solana/wallet-adapter-react';
import {LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {WalletMultiButton} from '@solana/wallet-adapter-react-ui';

interface DonateButtonProps {
    recipientAddress: string;
}

const UnwrappedDonateButton: FC<DonateButtonProps> = ({recipientAddress}) => {
    const [amount, setAmount] = useState<string>('');
    const [status, setStatus] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isValidAmount, setIsValidAmount] = useState<boolean>(false);

    const {connection} = useConnection();
    const {publicKey, sendTransaction, connected} = useWallet();

    // 🚀 Wallet Check
    if (!connected) {
        return (
            <div>
                <p className="text-red-500 mb-3">Please connect your wallet first to donate</p>
                <WalletMultiButton/>
            </div>
        );
    }

    const handleDonate = async () => {
        if (!publicKey || !amount) return;

        setIsLoading(true);
        setStatus('');
        setIsError(false);

        try {
            const recipientPubKey = new PublicKey(recipientAddress);
            const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: recipientPubKey,
                    lamports,
                })
            );

            const signature = await sendTransaction(transaction, connection);
            await connection.confirmTransaction(signature, 'confirmed');

            setStatus('Donation successful! Thank you for your support.');
            setAmount('');
        } catch (error) {
            console.error('Donation failed:', error);
            setIsError(true);
            setStatus(error instanceof Error ? error.message : 'Donation failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <WalletMultiButton/>
            <div className="flex gap-2 my-3">
                <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={amount}
                    onChange={(e) => {
                        const value = e.target.value;
                        setAmount(value);
                        const parsedValue = parseFloat(value);
                        setIsValidAmount(!isNaN(parsedValue) && parsedValue > 0);
                    }}
                    placeholder="SOL amount"
                    className="bg-[#1a1a1a] border border-[#333] rounded text-white px-3 py-2 w-[120px] focus:outline-none focus:border-[#666]"
                />
                <button
                    onClick={() => {
                        //eslint-disable-next-line @typescript-eslint/no-floating-promises
                        handleDonate()
                    }}
                    disabled={!publicKey || !isValidAmount || isLoading}
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
    return (
        <UnwrappedDonateButton {...props} />
    );
};