"use client";

import React, {FC, useMemo, useState} from "react";
import {ComputeBudgetProgram, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction,} from "@solana/web3.js";
import {useConnection, useWallet} from "@solana/wallet-adapter-react";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {supabase} from "../../../supabaseClient";

interface DonateButtonProps {
    recipientAddress: string;
    postId?: number;
}

// ✅ Type guard to check for Phantom's custom method
function supportsSignAndSend(
    // eslint-disable-next-line
    wallet: any
): wallet is { signAndSendTransaction: (tx: Transaction) => Promise<string> } {
    //eslint-disable-next-line
    return typeof wallet?.signAndSendTransaction === "function";
}

const UnwrappedDonateButton: React.FC<DonateButtonProps> = ({
                                                                recipientAddress,
                                                                postId,
                                                            }) => {
    const [amount, setAmount] = useState("");
    const [status, setStatus] = useState("");
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {connection} = useConnection();
    const wallet = useWallet();
    const {publicKey, signTransaction, connected} = wallet;

    const recipientPubKey = useMemo(
        () => new PublicKey(recipientAddress),
        [recipientAddress]
    );

    const calculatePriorityFee = async () => {
        try {
            const fees = await connection.getRecentPrioritizationFees();
            if (!fees.length) return 100_000_000;
            const avgFee =
                fees.reduce((sum, fee) => sum + fee.prioritizationFee, 0) /
                fees.length;
            return Math.ceil(avgFee * 100);
        } catch (err) {
            console.warn("Using fallback priority fee", err);
            return 100_000_000;
        }
    };

    const handleDonate = async () => {
        if (!publicKey || !amount || parseFloat(amount) <= 0) {
            setIsError(true);
            setStatus("Enter a valid amount.");
            return;
        }

        setIsLoading(true);
        setStatus("");
        setIsError(false);

        try {
            const lamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
            const priorityFee = await calculatePriorityFee();
            const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash(
                "finalized"
            );

            const transaction = new Transaction({
                feePayer: publicKey,
                recentBlockhash: blockhash,
            });

            transaction.add(
                ComputeBudgetProgram.setComputeUnitLimit({units: 1_400_000}),
                ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}),
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: recipientPubKey,
                    lamports,
                })
            );

            let signature: string;

            // ✅ Secure path for Phantom or compatible wallets
            if (supportsSignAndSend(wallet)) {
                signature = await wallet.signAndSendTransaction(transaction);
            }
            // ✅ Fallback for Solflare, Backpack, etc.
            else if (signTransaction) {
                const signedTx = await signTransaction(transaction);
                signature = await connection.sendRawTransaction(signedTx.serialize(), {
                    skipPreflight: false,
                    maxRetries: 5,
                });
            } else {
                throw new Error("Wallet does not support transaction signing.");
            }

            // Confirm the transaction
            const confirmation = await connection.confirmTransaction(
                {signature, blockhash, lastValidBlockHeight},
                "confirmed"
            );

            if (confirmation.value.err) {
                throw new Error("Transaction failed during confirmation.");
            }

            // ❇️ Transaction was successful, now update Supabase if we have a postId
            if (postId) {
                // 1) Fetch current donation JSONB
                const {data: postRow, error: fetchError} = await supabase
                    .from("posts")
                    .select("donated") // assume your JSONB column is called 'donated'
                    .eq("id", postId)
                    .single();

                if (fetchError) {
                    console.error("Error fetching post row:", fetchError);
                } else if (postRow) {
                    // 2) If no object, default to {}
                    //eslint-disable-next-line
                    let donated: Record<string, number> = postRow.donated || {};

                    // 3) Add or increment the donor's existing total
                    const donorKey = publicKey.toBase58(); // or toString()
                    const currentDonation = donated[donorKey] ?? 0;
                    const updatedDonation = currentDonation + parseFloat(amount);

                    donated = {
                        ...donated,
                        [donorKey]: updatedDonation,
                    };

                    // 4) Write updated object back to Supabase
                    const {error: updateError} = await supabase
                        .from("posts")
                        .update({donated})
                        .eq("id", postId);

                    if (updateError) {
                        console.error("Error updating donation JSONB:", updateError);
                    }
                }
            }

            // Finally, show success to the user
            setStatus(`✅ Donation successful! Signature: ${signature}`);
            setAmount("");
            //eslint-disable-next-line
        } catch (error: any) {
            console.error("Donation error:", error);
            if (
                //eslint-disable-next-line
                error.message?.includes("expired") ||
                //eslint-disable-next-line
                error.message?.includes("block height") ||
                //eslint-disable-next-line
                error.message?.includes("Blockhash not found")
            ) {
                setStatus("⏳ Transaction expired. Please retry quickly and confirm immediately.");
            } else {
                //eslint-disable-next-line
                setStatus(`❌ Error: ${error.message}`);
            }
            setIsError(true);
        } finally {
            setIsLoading(false);
        }
    };

    if (!connected) {
        return (
            <div>
                <p className="text-gray-500 mb-3">Please connect your wallet first.</p>
                <WalletMultiButton style={{backgroundColor: "#3377ff"}}/>
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
                    {isLoading ? "Processing..." : "Donate"}
                </button>
            </div>
            {status && (
                <div
                    className={`text-sm mt-2 ${isError ? "text-[#ff4444]" : "text-[#4caf50]"}`}
                >
                    {status}
                </div>
            )}
        </div>
    );
};

export const DonateButton: FC<DonateButtonProps> = (props) => {
    return <UnwrappedDonateButton {...props} />;
};