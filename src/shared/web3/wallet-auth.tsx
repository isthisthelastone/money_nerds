"use client";

import React, {ReactElement, useCallback, useEffect, useState} from "react";
import {QueryClient, QueryClientProvider, useMutation, useQueryClient,} from "@tanstack/react-query";
import {create} from "zustand";
import {IoLogInOutline} from "react-icons/io5";
import {FaRegCopy} from "react-icons/fa";
import {twMerge} from "tailwind-merge";
import {useWallet} from "@solana/wallet-adapter-react";

import dynamic from 'next/dynamic';

// Dynamically load WalletMultiButton on the client only
const VMB = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
    { ssr: false }
);

// --- API Response Interfaces ---
interface NonceResponse {
    nonce: string;

    [key: string]: unknown;
}

interface VerifyResponse {
    error?: string;
    message?: string;
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
    //eslint-disable-next-line
    user?: any;
}

// --- Zustand Store ---
interface BearState {
    isL: boolean;
    setIsL: (l: boolean) => void;
}

export const useAuthStore = create<BearState>((set) => ({
    isL: false,
    setIsL: (l) => set({isL: l}),
}));

export const queryClient = new QueryClient();

// tokenStore.ts --------------------------------------------------------------
const now   = () => Date.now();
//const hours = (h: number) => h * 60 * 60 * 1_000;

export function save(key: string, value: string, ttlMs: number) {
    localStorage.setItem(
        key,
        JSON.stringify({ value, exp: now() + ttlMs })
    );
}

export function load(key: string): string | null {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    try {
        const { value, exp } = JSON.parse(raw) as { value: string; exp: number };
        if (exp && exp < now()) {
            localStorage.removeItem(key);        // hard-expire
            return null;
        }
        return value;
    } catch {
        localStorage.removeItem(key);          // corrupted
        return null;
    }
}

export function clear(...keys: string[]) {
    keys.forEach(k => localStorage.removeItem(k));
}
const THREE_HOURS = 3 * 60 * 60 * 1_000;



// --- Main Component ---
export const PhantomWalletButton = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <PhantomWallet/>
        </QueryClientProvider>
    );
};

export const  PhantomWallet : () => ReactElement = () : ReactElement =>  {
    const queryClient = useQueryClient();
    const [error, setError] = useState<string | null>(null);

    const walletCtx = useWallet();

    // Функция отключения кошелька
    const disconnectWallet = useCallback(async() => {
        await walletCtx.disconnect();
        localStorage.removeItem("phantomWalletAddress");
        localStorage.removeItem("sb_access_token");
        localStorage.removeItem("sb_refresh_token");
    }, [walletCtx]);



    // --- Проверка валидности токена при монтировании ---
    useEffect(() => {
        const checkTokenValidity = async () => {
            const accessToken = localStorage.getItem("sb_access_token");
            if (!accessToken) return; // Нет токена – пользователь не залогинен

            try {
                const res = await fetch("/api/auth/check", {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                console.log("Token check status:", res.status);
                if (res.ok) {
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        //eslint-disable-next-line
                        const data = await res.json();
                        console.log("Token check data:", data);
                    } else {
                        console.log("Token check non-json response, assuming token is valid.");
                    }
                } else {
                    console.log("Token check failed with status:", res.status);
                    let errorMessage = "Session expired";
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        //eslint-disable-next-line
                        const errorData = await res.json();
                        console.log("Token check error data:", errorData);
                        //eslint-disable-next-line
                        errorMessage = errorData.error || errorMessage;
                    } else {
                        const errorText = await res.text();
                        console.log("Token check error text:", errorText);
                    }
                    throw new Error(errorMessage);
                }
            } catch (err) {
                console.error("Token validation error:", err);
                // Если ошибка проверки токена, выводим сообщение и отключаем кошелёк
                //eslint-disable-next-line
                alert("Session has expired. Please log in again.");
                localStorage.removeItem("phantomWalletAddress");
                await disconnectWallet();
            }


        };
        void checkTokenValidity().catch(() => {/* swallow or log the error */});

    }, [walletCtx]);

    // --- Мутация для логина ---
    const loginMutation = useMutation<
        { walletAddress: string; access_token?: string; refresh_token?: string },
        Error,
        void
    >({
        mutationFn: async () => {
            // 1. Проверка наличия Phantom
            if (
                typeof window === "undefined" ||
                !window.solana
            ) {
                throw new Error("Phantom Wallet is not installed!");
            }

            // 2.5 Check that the wallet is actually connected
            if (!walletCtx.publicKey) {
                throw new Error("Wallet not connected");
            }
            // 3. Получение nonce
            const nonceData = await queryClient.fetchQuery<NonceResponse>({
                queryKey: ["nonce-fetch"],
                queryFn: async () => {
                    const res = await fetch("/api/auth/nonce");
                    if (!res.ok) throw new Error("Failed to fetch nonce");
                    return await res.json() as NonceResponse;
                },
                staleTime: Infinity,
            });
            if (!nonceData.nonce) {
                throw new Error("No nonce in server response");
            }

            // 4. Подпись сообщения
            if (!window.solana.signMessage) {
                throw new Error("Phantom does not support signMessage");
            }
            const encodedNonce = new TextEncoder().encode(nonceData.nonce);
            const signatureResp = await window.solana.signMessage(encodedNonce, "utf8");
            const signature = signatureResp.signature;

            // 5. Верификация
            const verifyData = await queryClient.fetchQuery<VerifyResponse>({
                queryKey: ["verify-fetch"],
                queryFn: async () => {
                    const res = await fetch("/api/auth/verify", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            nonce: nonceData.nonce,
                            publicKey: walletCtx.publicKey?.toString(),
                            signature,
                            shouldCreate: true,
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

            return {
                walletAddress: walletCtx.publicKey.toString(),
                access_token: verifyData.access_token,
                refresh_token: verifyData.refresh_token,
            };
        },
        onSuccess: (data) => {
            // Сохраняем токены и адрес
            if (data.access_token) {
                save("sb_access_token",  data.access_token,  THREE_HOURS);
            }
            if (data.refresh_token) {
                save("sb_refresh_token", data.refresh_token, 24 * THREE_HOURS); // longer TTL
            }
            void walletCtx.connect()
        },
        onError: (err) => {
            setError(err.message);
            void walletCtx.disconnect()
        },
    });

    const handleConnect = async () => {
        setError(null);
        loginMutation.mutate();
        await walletCtx.connect();
    };


    return (
        <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
            {error && <p style={{color: "red"}}>{error}</p>}
            {walletCtx.connected ? (
                <WalletConnect
                    walletAddress={walletCtx.publicKey?.toString()}
                    disconnectWallet={() => {
                        void walletCtx.disconnect().catch(() => {/* swallow or log the error */});
                    }}
                />
            ) : (
                <VMB
                    onClick={void handleConnect}
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
                    {loginMutation.isPending ? "Connecting..." : "Connect Wallet"}
                </VMB>
            )}
        </div>
    );
}

function WalletConnect({
                           walletAddress,
                           disconnectWallet,
                       }: {
    walletAddress?: string;
    disconnectWallet: () => void;
}) {
    const [copied, setCopied] = useState(false);

    if(!walletAddress) return null;

    const copyToClipboard =  async () => {
        //eslint-disable-next-line
       await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        //eslint-disable-next-line 
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            className="flex flex-col items-center justify-center p-4 bg-gradient-to-b from-blue-900 to-indigo-900 rounded-xl shadow-lg w-full max-w-sm mx-auto text-white">
            <p className="text-sm font-medium opacity-80 mb-2">Connected Wallet:</p>
            <div className="flex items-center justify-between bg-white/10 p-2 rounded-lg w-full">
                <span className="truncate text-sm px-2">{walletAddress}</span>
                <button
                    onClick= { void copyToClipboard}
                    className={twMerge(
                        "p-1 rounded transition-all",
                        copied ? "text-green-400" : "text-white opacity-80 hover:opacity-100"
                    )}
                >
                    <FaRegCopy size={18}/>
                </button>
            </div>
            {copied && (
                <p className="text-xs text-green-400 mt-1">Copied to clipboard!</p>
            )}
            <button
                onClick={disconnectWallet}
                className="flex p-1 mt-4 rounded-lg items-center gap-2 bg-blue-500 hover:bg-blue-600 text-end justify-center text-white w-full"
            >
                <IoLogInOutline size={18}/> Disconnect
            </button>
        </div>
    );
}

export default PhantomWallet;