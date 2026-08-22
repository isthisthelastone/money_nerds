import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64, base64url, bech32, bech32m } from "@scure/base";
import bs58 from "bs58";

export const PAYOUT_ASSETS = [
  "SOL",
  "ETH",
  "USDT-ERC20",
  "BTC",
  "TRX",
  "USDT-TRC20",
  "TON",
  "INJ",
] as const;

export type PayoutAsset = (typeof PAYOUT_ASSETS)[number];
export type PayoutChainNamespace = "solana" | "eip155" | "bip122" | "tron" | "ton";
export type PayoutAssetKind = "native" | "token";

export interface PayoutAssetConfig {
  asset: PayoutAsset;
  symbol: "SOL" | "ETH" | "USDT" | "BTC" | "TRX" | "TON" | "INJ";
  chainNamespace: PayoutChainNamespace;
  networkReference: string;
  caipNetworkId: string;
  networkName: string;
  decimals: number;
  kind: PayoutAssetKind;
  tokenStandard: "ERC20" | "TRC20" | null;
  contractAddress: string | null;
}

const SOLANA_MAINNET_REFERENCE = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const BITCOIN_MAINNET_REFERENCE = "000000000019d6689c085ae165831e93";
const TRON_MAINNET_REFERENCE = "0x2b6653dc";
const TON_MAINNET_REFERENCE = "-239";

export const PAYOUT_ASSET_CONFIG: Record<PayoutAsset, PayoutAssetConfig> = {
  SOL: {
    asset: "SOL",
    symbol: "SOL",
    chainNamespace: "solana",
    networkReference: SOLANA_MAINNET_REFERENCE,
    caipNetworkId: `solana:${SOLANA_MAINNET_REFERENCE}`,
    networkName: "Solana Mainnet",
    decimals: 9,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
  ETH: {
    asset: "ETH",
    symbol: "ETH",
    chainNamespace: "eip155",
    networkReference: "1",
    caipNetworkId: "eip155:1",
    networkName: "Ethereum Mainnet",
    decimals: 18,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
  "USDT-ERC20": {
    asset: "USDT-ERC20",
    symbol: "USDT",
    chainNamespace: "eip155",
    networkReference: "1",
    caipNetworkId: "eip155:1",
    networkName: "Ethereum Mainnet",
    decimals: 6,
    kind: "token",
    tokenStandard: "ERC20",
    contractAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
  },
  BTC: {
    asset: "BTC",
    symbol: "BTC",
    chainNamespace: "bip122",
    networkReference: BITCOIN_MAINNET_REFERENCE,
    caipNetworkId: `bip122:${BITCOIN_MAINNET_REFERENCE}`,
    networkName: "Bitcoin Mainnet",
    decimals: 8,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
  TRX: {
    asset: "TRX",
    symbol: "TRX",
    chainNamespace: "tron",
    networkReference: TRON_MAINNET_REFERENCE,
    caipNetworkId: `tron:${TRON_MAINNET_REFERENCE}`,
    networkName: "TRON Mainnet",
    decimals: 6,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
  "USDT-TRC20": {
    asset: "USDT-TRC20",
    symbol: "USDT",
    chainNamespace: "tron",
    networkReference: TRON_MAINNET_REFERENCE,
    caipNetworkId: `tron:${TRON_MAINNET_REFERENCE}`,
    networkName: "TRON Mainnet",
    decimals: 6,
    kind: "token",
    tokenStandard: "TRC20",
    contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  },
  TON: {
    asset: "TON",
    symbol: "TON",
    chainNamespace: "ton",
    networkReference: TON_MAINNET_REFERENCE,
    caipNetworkId: `ton:${TON_MAINNET_REFERENCE}`,
    networkName: "TON Mainnet",
    decimals: 9,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
  INJ: {
    asset: "INJ",
    symbol: "INJ",
    chainNamespace: "eip155",
    networkReference: "1776",
    caipNetworkId: "eip155:1776",
    networkName: "Injective EVM Mainnet",
    decimals: 18,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
  },
};

export interface VerifiedPayoutOption {
  id: string;
  profileWallet: string;
  asset: PayoutAsset;
  address: string;
  verifiedAt: string;
  createdAt: string;
  config: PayoutAssetConfig;
}

export function isPayoutAsset(value: string): value is PayoutAsset {
  return PAYOUT_ASSETS.includes(value as PayoutAsset);
}

export function payoutRouteMatches(
  asset: PayoutAsset,
  chainNamespace: string,
  networkReference: string,
) {
  const config = PAYOUT_ASSET_CONFIG[asset];
  return (
    config.chainNamespace === chainNamespace &&
    config.networkReference === networkReference
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function allZero(bytes: Uint8Array) {
  return bytes.every((byte) => byte === 0);
}

function doubleSha256(bytes: Uint8Array) {
  return sha256(sha256(bytes));
}

function normalizeSolanaAddress(value: string) {
  try {
    const decoded = bs58.decode(value);
    if (decoded.length !== 32 || allZero(decoded) || bs58.encode(decoded) !== value) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function normalizeEvmAddress(value: string) {
  if (!/^0x[0-9a-fA-F]{40}$/i.test(value)) return null;
  const hex = value.slice(2);
  if (/^0{40}$/.test(hex)) return null;

  const lower = hex.toLowerCase();
  const isUniformCase = hex === lower || hex === hex.toUpperCase();
  if (!isUniformCase) {
    const hash = Array.from(keccak_256(new TextEncoder().encode(lower)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    for (let index = 0; index < hex.length; index += 1) {
      const character = hex[index];
      if (!/[a-fA-F]/.test(character)) continue;
      const shouldBeUpper = Number.parseInt(hash[index], 16) >= 8;
      if (shouldBeUpper !== (character === character.toUpperCase())) return null;
    }
  }
  return `0x${lower}`;
}

function normalizeBitcoinBase58Address(value: string) {
  try {
    const decoded = bs58.decode(value);
    if (decoded.length !== 25 || bs58.encode(decoded) !== value) return null;
    const payload = decoded.subarray(0, 21);
    const checksum = decoded.subarray(21);
    if ((payload[0] !== 0x00 && payload[0] !== 0x05) || allZero(payload.subarray(1))) {
      return null;
    }
    if (!equalBytes(checksum, doubleSha256(payload).subarray(0, 4))) return null;
    return value;
  } catch {
    return null;
  }
}

function normalizeBitcoinSegwitAddress(value: string) {
  const hasLower = value !== value.toUpperCase();
  const hasUpper = value !== value.toLowerCase();
  if (hasLower && hasUpper) return null;
  const normalized = value.toLowerCase();

  for (const encoding of [bech32, bech32m]) {
    try {
      const decoded = encoding.decode(normalized, 90);
      if (decoded.prefix !== "bc" || decoded.words.length < 2) continue;
      const version = decoded.words[0];
      if (version < 0 || version > 16) continue;
      if (version === 0 && encoding !== bech32) continue;
      if (version > 0 && encoding !== bech32m) continue;
      const program = encoding.fromWords(decoded.words.slice(1));
      if (program.length < 2 || program.length > 40) continue;
      if (version === 0 && program.length !== 20 && program.length !== 32) continue;
      return normalized;
    } catch {
      // Try the other checksum encoding before rejecting the address.
    }
  }
  return null;
}

function normalizeBitcoinAddress(value: string) {
  return normalizeBitcoinBase58Address(value) ?? normalizeBitcoinSegwitAddress(value);
}

function normalizeTronAddress(value: string) {
  try {
    const decoded = bs58.decode(value);
    if (decoded.length !== 25 || decoded[0] !== 0x41 || bs58.encode(decoded) !== value) {
      return null;
    }
    const payload = decoded.subarray(0, 21);
    if (allZero(payload.subarray(1))) return null;
    if (!equalBytes(decoded.subarray(21), doubleSha256(payload).subarray(0, 4))) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function crc16Ccitt(bytes: Uint8Array) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

function normalizeTonRawAddress(value: string) {
  const match = /^(-1|0):([0-9a-fA-F]{64})$/.exec(value);
  if (!match || /^0{64}$/.test(match[2])) return null;
  return `${match[1]}:${match[2].toLowerCase()}`;
}

function normalizeTonFriendlyAddress(value: string) {
  if (value.length !== 48) return null;
  try {
    const decoded = /[-_]/.test(value) ? base64url.decode(value) : base64.decode(value);
    if (decoded.length !== 36) return null;
    const tag = decoded[0];
    const testOnly = (tag & 0x80) !== 0;
    const addressTag = tag & 0x7f;
    if (testOnly || (addressTag !== 0x11 && addressTag !== 0x51)) return null;

    const workchain = decoded[1] === 0 ? 0 : decoded[1] === 0xff ? -1 : null;
    if (workchain === null) return null;
    const hash = decoded.subarray(2, 34);
    if (allZero(hash)) return null;

    const expectedCrc = crc16Ccitt(decoded.subarray(0, 34));
    const actualCrc = (decoded[34] << 8) | decoded[35];
    if (expectedCrc !== actualCrc) return null;

    const hashHex = Array.from(hash)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `${workchain}:${hashHex}`;
  } catch {
    return null;
  }
}

function normalizeTonAddress(value: string) {
  return normalizeTonRawAddress(value) ?? normalizeTonFriendlyAddress(value);
}

export function normalizePayoutAddress(asset: string, input: string) {
  const value = input.trim();
  if (!isPayoutAsset(asset) || !value || value.length > 128) return null;

  switch (PAYOUT_ASSET_CONFIG[asset].chainNamespace) {
    case "solana":
      return normalizeSolanaAddress(value);
    case "eip155":
      return normalizeEvmAddress(value);
    case "bip122":
      return normalizeBitcoinAddress(value);
    case "tron":
      return normalizeTronAddress(value);
    case "ton":
      return normalizeTonAddress(value);
  }
}
