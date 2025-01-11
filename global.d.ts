export {};

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: (options?: {
        onlyIfTrusted?: boolean;
      }) => Promise<{ publicKey: { toString(): string } }>;
      disconnect: () => Promise<void>;
    };
  }
}
