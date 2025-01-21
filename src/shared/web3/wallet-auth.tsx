"use client";

import React, {useEffect, useState} from "react";
import {QueryClient, QueryClientProvider, useMutation, useQueryClient} from "@tanstack/react-query";
import {create} from 'zustand'

/** The response from GET /api/auth/nonce */
interface NonceResponse {
    nonce: string;

    [key: string]: unknown;
}

/** The response from POST /api/auth/verify (Supabase built-in Auth style) */
interface VerifyResponse {
    error?: string;
    message?: string;
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    user?: any; // or a more specific type if desired
}


// Define the shape of your store
interface BearState {
    isL: boolean
    setIsL: (l: boolean) => void
}

// Create the store
export const useAuthStore = create<BearState>((set) => ({
    isL: false,
    setIsL: (l) => set({isL: l})
}));

export const queryClient = new QueryClient();

export const PhantomWalletButton = () => {
    return <QueryClientProvider client={queryClient}>
        <PhantomWallet/>
    </QueryClientProvider>

}

/** A single component handling connect → nonce → sign → verify, using v5 of TanStack Query. */
export function PhantomWallet() {
    const queryClient = useQueryClient();

    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const {setIsL} = useAuthStore();

    /**
     * The big mutation that:
     * 1) Connects Phantom
     * 2) GET /api/auth/nonce (via queryClient.fetchQuery)
     * 3) signMessage
     * 4) POST /api/auth/verify
     */
    const loginMutation = useMutation<
        // success data
        { walletAddress: string; access_token?: string; refresh_token?: string },
        // error type
        Error,
        // variables (none)
        void
    >({
        mutationFn: async () => {
            // 1) Check Phantom
            if (
                typeof window === "undefined" ||
                !window.solana ||
                !window.solana.isPhantom
            ) {
                throw new Error("Phantom Wallet is not installed!");
            }

            // 2) Connect to Phantom
            const resp = await window.solana.connect({onlyIfTrusted: false});
            const address = resp?.publicKey?.toString();
            if (!address) {
                throw new Error("No public key from Phantom");
            }

            // 3) GET nonce
            const nonceData = await queryClient.fetchQuery<NonceResponse>({
                queryKey: ["nonce-fetch"],
                queryFn: async () => {
                    const res = await fetch("/api/auth/nonce");
                    if (!res.ok) throw new Error("Failed to fetch nonce");
                    return res.json() as Promise<NonceResponse>;
                },
                // We'll fetch it once per mutation, so staleTime can be Infinity or 0
                staleTime: Infinity,
            });

            if (!nonceData.nonce) {
                throw new Error("No nonce in server response");
            }

            // 4) signMessage
            if (!window.solana.signMessage) {
                throw new Error("Phantom does not support signMessage");
            }
            const encodedNonce = new TextEncoder().encode(nonceData.nonce);
            const signatureResp = await window.solana.signMessage(
                encodedNonce,
                "utf8"
            );
            // Could be a base58 string or raw bytes
            const signature = signatureResp.signature;

            // 5) POST verify
            const verifyData = await queryClient.fetchQuery<VerifyResponse>({
                queryKey: ["verify-fetch"],
                queryFn: async () => {
                    const res = await fetch("/api/auth/verify", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            nonce: nonceData.nonce,
                            publicKey: address,
                            signature,
                        }),
                    });
                    const data = (await res.json()) as VerifyResponse;
                    if (!res.ok) {
                        throw new Error(data.error || "Verification failed");
                    }
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    return data;
                },
                staleTime: Infinity,
            });

            // We should have { access_token, refresh_token, etc. }
            return {
                walletAddress: address,
                access_token: verifyData.access_token,
                refresh_token: verifyData.refresh_token,
            };
        },
        onSuccess: (data) => {
            // Persist wallet & tokens in localStorage
            if (data.access_token) {
                localStorage.setItem("sb_access_token", data.access_token);
            }
            if (data.refresh_token) {
                localStorage.setItem("sb_refresh_token", data.refresh_token);
            }
            localStorage.setItem("phantomWalletAddress", data.walletAddress);

            // Update local state
            setWalletAddress(data.walletAddress);
            setIsL(true)
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    /** Click handler: runs the mutation. */
    const handleConnect = () => {
        setError(null);
        loginMutation.mutate();
    };

    /** Disconnect logic */
    const disconnectWallet = () => {
        setWalletAddress(null);
        setIsL(false);
        localStorage.removeItem("phantomWalletAddress");
        localStorage.removeItem("sb_access_token");
        localStorage.removeItem("sb_refresh_token");
    };

    /** On mount, restore from localStorage */
    useEffect(() => {
        const storedAddr = localStorage.getItem("phantomWalletAddress");
        if (storedAddr) setWalletAddress(storedAddr);
    }, []);

    return (
        <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
            {error && <p style={{color: "red"}}>{error}</p>}

            {walletAddress ? (
                <div>
                    <p>Connected Wallet: {walletAddress}</p>
                    <button onClick={disconnectWallet}>Disconnect</button>
                </div>
            ) : (
                <button
                    onClick={handleConnect}
                    // For TanStack Query v5, `loginMutation.isPending` replaces `isLoading`.
                    disabled={loginMutation.isPending}
                    style={{
                        padding: "0.5rem 1rem",
                        borderRadius: "5px",
                        backgroundColor: "#5c67f2",
                        border: "none",
                        color: "white",
                        cursor: loginMutation.isPending ? "wait" : "pointer",
                    }}
                >
                    {loginMutation.isPending ? "Connecting..." : "Connect Phantom"}
                </button>
            )}
        </div>
    );
}