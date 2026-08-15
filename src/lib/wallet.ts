import { PublicKey } from "@solana/web3.js";

export function normalizeWallet(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new PublicKey(value.trim()).toBase58();
  } catch {
    return null;
  }
}

