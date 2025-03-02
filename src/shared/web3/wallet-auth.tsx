"use client";

import React, {useCallback, useEffect, useState} from "react";
import {QueryClient, QueryClientProvider, useMutation, useQueryClient,} from "@tanstack/react-query";
import {create} from "zustand";
import {IoLogInOutline} from "react-icons/io5";
import {FaRegCopy} from "react-icons/fa";
import {twMerge} from "tailwind-merge";

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

// --- Main Component ---
export const PhantomWalletButton = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <PhantomWallet/>
        </QueryClientProvider>
    );
};

export function PhantomWallet() {
    const queryClient = useQueryClient();
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const {setIsL} = useAuthStore();

    // Функция отключения кошелька
    const disconnectWallet = useCallback(() => {
        setWalletAddress(null);
        setIsL(false);
        localStorage.removeItem("phantomWalletAddress");
        localStorage.removeItem("sb_access_token");
        localStorage.removeItem("sb_refresh_token");
    }, [setIsL]);

    // Восстанавливаем состояние авторизации из localStorage
    useEffect(() => {
        setIsL(Boolean(localStorage.getItem("phantomWalletAddress")));
    }, [setIsL]);

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
                disconnectWallet();
            }
        };
//eslint-disable-next-line
        checkTokenValidity();
    }, [disconnectWallet]);

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
                !window.solana ||
                !window.solana.isPhantom
            ) {
                throw new Error("Phantom Wallet is not installed!");
            }

            // 2. Подключение к Phantom
            const resp = await window.solana.connect({onlyIfTrusted: false});
            const address = resp?.publicKey?.toString();
            if (!address) {
                throw new Error("No public key from Phantom");
            }

            // 3. Получение nonce
            const nonceData = await queryClient.fetchQuery<NonceResponse>({
                queryKey: ["nonce-fetch"],
                queryFn: async () => {
                    const res = await fetch("/api/auth/nonce");
                    if (!res.ok) throw new Error("Failed to fetch nonce");
                    return res.json() as Promise<NonceResponse>;
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
                            publicKey: address,
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
                walletAddress: address,
                access_token: verifyData.access_token,
                refresh_token: verifyData.refresh_token,
            };
        },
        onSuccess: (data) => {
            // Сохраняем токены и адрес
            if (data.access_token) {
                localStorage.setItem("sb_access_token", data.access_token);
            }
            if (data.refresh_token) {
                localStorage.setItem("sb_refresh_token", data.refresh_token);
            }
            localStorage.setItem("phantomWalletAddress", data.walletAddress);
            setWalletAddress(data.walletAddress);
            setIsL(true);
        },
        onError: (err) => {
            setError(err.message);
        },
    });

    const handleConnect = () => {
        setError(null);
        loginMutation.mutate();
    };

    // Восстанавливаем адрес кошелька из localStorage
    useEffect(() => {
        const storedAddr = localStorage.getItem("phantomWalletAddress");
        if (storedAddr) setWalletAddress(storedAddr);
    }, []);

    return (
        <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
            {error && <p style={{color: "red"}}>{error}</p>}
            {walletAddress ? (
                <WalletConnect
                    walletAddress={walletAddress}
                    disconnectWallet={disconnectWallet}
                />
            ) : (
                <button
                    onClick={handleConnect}
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

function WalletConnect({
                           walletAddress,
                           disconnectWallet,
                       }: {
    walletAddress: string;
    disconnectWallet: () => void;
}) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        //eslint-disable-next-line
        navigator.clipboard.writeText(walletAddress);
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
                    onClick={copyToClipboard}
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