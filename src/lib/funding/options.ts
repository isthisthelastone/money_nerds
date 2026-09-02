import {
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSETS,
  type PayoutAsset,
} from "@/lib/funding/payouts";

export interface FundingOptionInput {
  asset: PayoutAsset;
  address: string;
}

export const MAX_FUNDING_OPTIONS_JSON_LENGTH = 4_096;

export function normalizeFundingOptions(
  input: readonly FundingOptionInput[],
): FundingOptionInput[] {
  if (input.length > PAYOUT_ASSETS.length) throw new Error("TOO_MANY_FUNDING_OPTIONS");

  const seen = new Set<PayoutAsset>();
  return input.map((option) => {
    if (!isPayoutAsset(option.asset) || seen.has(option.asset)) {
      throw new Error("INVALID_FUNDING_OPTIONS");
    }
    seen.add(option.asset);
    const address = normalizePayoutAddress(option.asset, option.address);
    if (!address) throw new Error("INVALID_FUNDING_ADDRESS");
    return { asset: option.asset, address };
  });
}

export function parseFundingOptions(value: string): FundingOptionInput[] {
  if (value.length > MAX_FUNDING_OPTIONS_JSON_LENGTH) {
    throw new Error("INVALID_FUNDING_OPTIONS");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value || "[]");
  } catch {
    throw new Error("INVALID_FUNDING_OPTIONS");
  }
  if (!Array.isArray(parsed)) throw new Error("INVALID_FUNDING_OPTIONS");

  const options = parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("INVALID_FUNDING_OPTIONS");
    const candidate = item as { asset?: unknown; address?: unknown };
    if (typeof candidate.asset !== "string" || typeof candidate.address !== "string") {
      throw new Error("INVALID_FUNDING_OPTIONS");
    }
    return { asset: candidate.asset as PayoutAsset, address: candidate.address };
  });
  return normalizeFundingOptions(options);
}

