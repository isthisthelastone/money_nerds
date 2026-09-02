import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64, base64url, bech32, bech32m } from "@scure/base";
import bs58 from "bs58";

export const PAYOUT_ASSETS = [
  "SOL",
  "USDC-SOL",
  "USDT-SOL",
  "ETH",
  "USDT-ERC20",
  "BTC",
  "TRX",
  "USDT-TRC20",
  "TON",
  "INJ",
] as const;

export type PayoutAsset = (typeof PAYOUT_ASSETS)[number];
export type PayoutChainNamespace = "solana" | "eip155" | "bip122" | "tron" | "ton" | "cosmos";
export type PayoutAssetKind = "native" | "token";

export interface PayoutAssetConfig {
  asset: PayoutAsset;
  symbol: "SOL" | "USDC" | "ETH" | "USDT" | "BTC" | "TRX" | "TON" | "INJ";
  chainNamespace: PayoutChainNamespace;
  networkReference: string;
  caipNetworkId: string;
  networkName: string;
  decimals: number;
  kind: PayoutAssetKind;
  tokenStandard: "SPL" | "ERC20" | "TRC20" | null;
  contractAddress: string | null;
  walletMode: "solana" | "evm" | "manual";
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
    walletMode: "solana",
  },
  "USDC-SOL": {
    asset: "USDC-SOL",
    symbol: "USDC",
    chainNamespace: "solana",
    networkReference: SOLANA_MAINNET_REFERENCE,
    caipNetworkId: `solana:${SOLANA_MAINNET_REFERENCE}`,
    networkName: "Solana Mainnet",
    decimals: 6,
    kind: "token",
    tokenStandard: "SPL",
    contractAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    walletMode: "solana",
  },
  "USDT-SOL": {
    asset: "USDT-SOL",
    symbol: "USDT",
    chainNamespace: "solana",
    networkReference: SOLANA_MAINNET_REFERENCE,
    caipNetworkId: `solana:${SOLANA_MAINNET_REFERENCE}`,
    networkName: "Solana Mainnet",
    decimals: 6,
    kind: "token",
    tokenStandard: "SPL",
    contractAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    walletMode: "solana",
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
    walletMode: "evm",
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
    walletMode: "evm",
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
    walletMode: "manual",
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
    walletMode: "manual",
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
    walletMode: "manual",
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
    walletMode: "manual",
  },
  INJ: {
    asset: "INJ",
    symbol: "INJ",
    chainNamespace: "cosmos",
    networkReference: "injective-1",
    caipNetworkId: "cosmos:injective-1",
    networkName: "Injective Mainnet",
    decimals: 18,
    kind: "native",
    tokenStandard: null,
    contractAddress: null,
    walletMode: "manual",
  },
};

export interface FundingOption {
  id: string;
  asset: PayoutAsset;
  address: string;
  config: PayoutAssetConfig;
  verificationStatus: "self_declared" | "verified";
}

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

const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.(\d+))?$/;
const MAX_UINT_256 = (1n << 256n) - 1n;

/** Convert a human amount to its exact smallest-unit representation without floats. */
export function decimalAmountToAtomic(asset: PayoutAsset, input: string) {
  const value = input.trim();
  if (value.length > 96) return null;
  const match = DECIMAL_AMOUNT_PATTERN.exec(value);
  if (!match) return null;
  const decimals = PAYOUT_ASSET_CONFIG[asset].decimals;
  const fraction = match[1] ?? "";
  if (fraction.length > decimals) return null;
  const [whole = "0"] = value.split(".");
  const atomic = BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (atomic < 1n || atomic > MAX_UINT_256) return null;
  return atomic;
}

export function isValidAtomicAmount(value: string) {
  if (!/^[1-9]\d{0,77}$/.test(value)) return false;
  try {
    return BigInt(value) <= MAX_UINT_256;
  } catch {
    return false;
  }
}

export function atomicAmountToDecimal(asset: PayoutAsset, atomicInput: string | bigint) {
  const atomic = typeof atomicInput === "bigint" ? atomicInput : BigInt(atomicInput);
  const decimals = PAYOUT_ASSET_CONFIG[asset].decimals;
  if (!decimals) return atomic.toString();
  const padded = atomic.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export function buildPaymentUri(
  asset: PayoutAsset,
  address: string,
  atomicAmount: string,
  intentId: string,
) {
  const config = PAYOUT_ASSET_CONFIG[asset];
  const amount = atomicAmountToDecimal(asset, atomicAmount);
  const memo = `moneynerds:${intentId}`;
  const query = new URLSearchParams({ amount, memo });

  if (config.chainNamespace === "solana") {
    if (config.contractAddress) query.set("spl-token", config.contractAddress);
    return `solana:${address}?${query.toString()}`;
  }
  if (asset === "BTC") {
    return `bitcoin:${address}?${new URLSearchParams({
      amount,
      label: "Money Nerds",
      message: memo,
    }).toString()}`;
  }
  if (asset === "TON") {
    return `ton://transfer/${address}?${new URLSearchParams({
      amount: atomicAmount,
      text: memo,
    }).toString()}`;
  }
  if (asset === "TRX" || asset === "USDT-TRC20") {
    return `tron:${address}?${query.toString()}`;
  }
  if (asset === "INJ") return `injective:${address}?${query.toString()}`;
  if (asset === "ETH") return `ethereum:${address}@1?value=${atomicAmount}`;
  return `ethereum:${config.contractAddress}@1/transfer?address=${address}&uint256=${atomicAmount}`;
}

export function transactionExplorerUrl(asset: PayoutAsset, transactionId: string) {
  const encoded = encodeURIComponent(transactionId);
  switch (PAYOUT_ASSET_CONFIG[asset].chainNamespace) {
    case "solana":
      return `https://solscan.io/tx/${encoded}`;
    case "eip155":
      return `https://etherscan.io/tx/${encoded}`;
    case "bip122":
      return `https://mempool.space/tx/${encoded}`;
    case "tron":
      return `https://tronscan.org/#/transaction/${encoded}`;
    case "ton":
      return `https://tonviewer.com/transaction/${encoded}`;
    case "cosmos":
      return `https://explorer.injective.network/transaction/${encoded}`;
  }
}

export function addressExplorerUrl(asset: PayoutAsset, address: string) {
  const encoded = encodeURIComponent(address);
  switch (PAYOUT_ASSET_CONFIG[asset].chainNamespace) {
    case "solana":
      return `https://solscan.io/account/${encoded}`;
    case "eip155":
      return `https://etherscan.io/address/${encoded}`;
    case "bip122":
      return `https://mempool.space/address/${encoded}`;
    case "tron":
      return `https://tronscan.org/#/address/${encoded}`;
    case "ton":
      return `https://tonviewer.com/${encoded}`;
    case "cosmos":
      return `https://explorer.injective.network/account/${encoded}`;
  }
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

function normalizeInjectiveAddress(value: string) {
  const hasLower = value !== value.toUpperCase();
  const hasUpper = value !== value.toLowerCase();
  if (hasLower && hasUpper) return null;
  const normalized = value.toLowerCase();
  try {
    const decoded = bech32.decode(normalized, 90);
    const bytes = bech32.fromWords(decoded.words);
    if (decoded.prefix !== "inj" || bytes.length !== 20 || allZero(bytes)) return null;
    return normalized;
  } catch {
    return null;
  }
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
    case "cosmos":
      return normalizeInjectiveAddress(value);
  }
}
