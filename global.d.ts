export {};

declare global {
    interface Window {
        solana?: {
            isPhantom?: boolean;
            connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{
                publicKey: {
                    toString(): string;
                };
            }>;
            signMessage?: (
                message: Uint8Array,
                display?: 'utf8'
            ) => Promise<{
                signature: Uint8Array; // base58 or raw bytes, depends on Phantom version
                publicKey: Uint8Array;
            }>;
        };
    }
}

declare const navigator: Navigator;
