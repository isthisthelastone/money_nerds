import assert from "node:assert/strict";
import test from "node:test";
import {
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  payoutRouteMatches,
} from "../src/lib/funding/payouts.ts";

test("SOL accepts only canonical, nonzero 32-byte mainnet addresses", () => {
  const address = "BqzLRNsHraeahvfppDs9QmRDdYx3gUYt69pgA6UR9GQg";
  assert.equal(normalizePayoutAddress("SOL", ` ${address} `), address);
  assert.equal(normalizePayoutAddress("SOL", "11111111111111111111111111111111"), null);
  assert.equal(normalizePayoutAddress("SOL", `${address}0`), null);
});

test("Ethereum and Injective EVM enforce EIP-55 mixed-case checksums", () => {
  const checksummed = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
  const normalized = "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed";
  assert.equal(normalizePayoutAddress("ETH", checksummed), normalized);
  assert.equal(normalizePayoutAddress("USDT-ERC20", checksummed), normalized);
  assert.equal(normalizePayoutAddress("INJ", checksummed), normalized);
  assert.equal(
    normalizePayoutAddress("ETH", "0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    null,
  );
  assert.equal(normalizePayoutAddress("ETH", "0x0000000000000000000000000000000000000000"), null);
});

test("Bitcoin mainnet validates Base58Check, Bech32, Bech32m, and network", () => {
  const legacy = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
  const segwit = "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4";
  const taproot = "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0";
  assert.equal(normalizePayoutAddress("BTC", legacy), legacy);
  assert.equal(normalizePayoutAddress("BTC", segwit), segwit.toLowerCase());
  assert.equal(normalizePayoutAddress("BTC", taproot), taproot);
  assert.equal(normalizePayoutAddress("BTC", `${legacy.slice(0, -1)}b`), null);
  assert.equal(
    normalizePayoutAddress("BTC", "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7"),
    null,
  );
});

test("TRON and USDT-TRC20 require a valid mainnet Base58Check address", () => {
  const address = "TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL";
  assert.equal(normalizePayoutAddress("TRX", address), address);
  assert.equal(normalizePayoutAddress("USDT-TRC20", address), address);
  assert.equal(normalizePayoutAddress("TRX", `${address.slice(0, -1)}M`), null);
  assert.equal(normalizePayoutAddress("TRX", "410000000000000000000000000000000000000000"), null);
});

test("TON friendly forms normalize to one checked raw mainnet address", () => {
  const raw = "-1:e56754f83426f69b09267bd876ac97c44821345b7e266bd956a7bfbfb98df35c";
  const bounceable = "Ef_lZ1T4NCb2mwkme9h2rJfESCE0W34ma9lWp7-_uY3zXDvq";
  const nonBounceable = "Uf_lZ1T4NCb2mwkme9h2rJfESCE0W34ma9lWp7-_uY3zXGYv";
  assert.equal(normalizePayoutAddress("TON", bounceable), raw);
  assert.equal(normalizePayoutAddress("TON", nonBounceable), raw);
  assert.equal(normalizePayoutAddress("TON", raw.toUpperCase()), raw);
  assert.equal(normalizePayoutAddress("TON", `${bounceable.slice(0, -1)}A`), null);
  assert.equal(normalizePayoutAddress("TON", `0:${"0".repeat(64)}`), null);
});

test("asset metadata pins exact CAIP networks and official USDT contracts", () => {
  assert.equal(PAYOUT_ASSET_CONFIG.SOL.caipNetworkId, "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp");
  assert.equal(PAYOUT_ASSET_CONFIG.BTC.caipNetworkId, "bip122:000000000019d6689c085ae165831e93");
  assert.equal(PAYOUT_ASSET_CONFIG.INJ.caipNetworkId, "eip155:1776");
  assert.equal(
    PAYOUT_ASSET_CONFIG["USDT-ERC20"].contractAddress,
    "0xdac17f958d2ee523a2206206994597c13d831ec7",
  );
  assert.equal(
    PAYOUT_ASSET_CONFIG["USDT-TRC20"].contractAddress,
    "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  );
  assert.equal(payoutRouteMatches("INJ", "eip155", "1776"), true);
  assert.equal(payoutRouteMatches("INJ", "eip155", "1"), false);
  assert.equal(isPayoutAsset("USDT-TRC20"), true);
  assert.equal(isPayoutAsset("USDT"), false);
  assert.equal(normalizePayoutAddress("USDT", "0x1111111111111111111111111111111111111111"), null);
});
