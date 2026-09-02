import { SERVICE_WALLET } from "@/lib/config";
import {
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  PAYOUT_ASSETS,
  type FundingOption,
  type PayoutAsset,
} from "@/lib/funding/payouts";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type FundingTargetType = "post" | "comment" | "service";

export interface ResolvedFundingOption extends FundingOption {
  chainNamespace: string;
  networkReference: string;
  postFundingOptionId: string | null;
  profileFundingRouteId: string | null;
}

const SERVICE_ENV_KEYS: Record<PayoutAsset, readonly string[]> = {
  SOL: ["SOLANA_PUBLIC_WALLET"],
  "USDC-SOL": ["USDC_SOLANA_PUBLIC_WALLET"],
  "USDT-SOL": ["USDT_SOLANA_PUBLIC_WALLET"],
  ETH: ["ETHEREUM_PUBLIC_WALLET"],
  "USDT-ERC20": ["USDT_ERC_PUBLIC_WALLET"],
  BTC: ["BITCOIN_PUBLIC_WALLET"],
  TRX: ["TRON_PUBLIC_WALLET", "TRON (TRX)_PUBLIC_WALLET"],
  "USDT-TRC20": ["USDT_TRC_PUBLIC_WALLET"],
  TON: ["TON_PUBLIC_WALLET", "TON(GRAM)_PUBLIC_WALLET"],
  INJ: ["INJECTIVE_PUBLIC_WALLET"],
};

function serviceAddress(asset: PayoutAsset) {
  for (const key of SERVICE_ENV_KEYS[asset]) {
    const normalized = normalizePayoutAddress(asset, process.env[key] ?? "");
    if (normalized) return normalized;
  }
  return asset === "SOL" ? normalizePayoutAddress("SOL", SERVICE_WALLET) : null;
}

export function getServiceFundingOptions(): ResolvedFundingOption[] {
  return PAYOUT_ASSETS.flatMap((asset) => {
    const address = serviceAddress(asset);
    if (!address) return [];
    const config = PAYOUT_ASSET_CONFIG[asset];
    return [{
      id: `service:${asset}`,
      asset,
      address,
      config,
      verificationStatus: "verified" as const,
      chainNamespace: config.chainNamespace,
      networkReference: config.networkReference,
      postFundingOptionId: null,
      profileFundingRouteId: null,
    }];
  });
}

interface FundingRow {
  id?: unknown;
  asset?: unknown;
  chain_namespace?: unknown;
  network_reference?: unknown;
  recipient_address?: unknown;
  normalized_address?: unknown;
  verification_status?: unknown;
  verified_at?: unknown;
}

function parseFundingRow(
  row: FundingRow,
  source: "post" | "profile" | "legacy",
): ResolvedFundingOption | null {
  const id = typeof row.id === "string" ? row.id : "";
  const asset = typeof row.asset === "string" ? row.asset : "";
  const address = typeof row.recipient_address === "string"
    ? row.recipient_address
    : typeof row.normalized_address === "string"
      ? row.normalized_address
      : "";
  const status = row.verification_status === "self_declared" ? "self_declared" : "verified";
  if (!id || !isPayoutAsset(asset) || normalizePayoutAddress(asset, address) !== address) {
    return null;
  }
  if (row.verification_status && row.verification_status !== "self_declared" && row.verification_status !== "verified") {
    return null;
  }
  const config = PAYOUT_ASSET_CONFIG[asset];
  const chainNamespace = typeof row.chain_namespace === "string"
    ? row.chain_namespace
    : config.chainNamespace;
  const networkReference = typeof row.network_reference === "string"
    ? row.network_reference
    : config.networkReference;
  if (
    chainNamespace !== config.chainNamespace ||
    networkReference !== config.networkReference
  ) {
    return null;
  }
  return {
    id,
    asset,
    address,
    config,
    verificationStatus: status,
    chainNamespace,
    networkReference,
    postFundingOptionId: source === "post" ? id : null,
    profileFundingRouteId: source === "profile" ? id : null,
  };
}

async function loadProfileOptions(profileWallet: string) {
  const supabase = createAdminSupabase();
  const current = await supabase
    .from("profile_funding_routes")
    .select("id, asset, chain_namespace, network_reference, recipient_address, verification_status")
    .eq("profile_wallet", profileWallet)
    .in("verification_status", ["self_declared", "verified"])
    .order("asset", { ascending: true });

  if (!current.error) {
    return (current.data as FundingRow[] | null | undefined)
      ?.map((row) => parseFundingRow(row, "profile"))
      .filter((option): option is ResolvedFundingOption => option !== null) ?? [];
  }

  // Compatibility while the multichain migration rolls out.
  const legacy = await supabase
    .from("verified_payout_accounts")
    .select("id, asset, chain_namespace, network_reference, normalized_address, verified_at")
    .eq("profile_wallet", profileWallet)
    .order("asset", { ascending: true });
  if (legacy.error) {
    console.error("Unable to resolve profile funding routes", {
      currentCode: current.error.code,
      legacyCode: legacy.error.code,
    });
    return [];
  }
  return (legacy.data as FundingRow[] | null | undefined)
    ?.map((row) => parseFundingRow(row, "legacy"))
    .filter((option): option is ResolvedFundingOption => option !== null) ?? [];
}

export async function resolveTargetFundingOptions(
  targetType: FundingTargetType,
  targetId?: number,
): Promise<ResolvedFundingOption[]> {
  if (targetType === "service") return getServiceFundingOptions();
  if (!Number.isSafeInteger(targetId) || Number(targetId) <= 0) return [];

  const supabase = createAdminSupabase();
  if (targetType === "post") {
    const result = await supabase
      .from("post_funding_options")
      .select("id, asset, chain_namespace, network_reference, recipient_address, verification_status")
      .eq("post_id", targetId as number)
      .in("verification_status", ["self_declared", "verified"])
      .order("asset", { ascending: true });
    if (!result.error) {
      return (result.data as FundingRow[] | null | undefined)
        ?.map((row) => parseFundingRow(row, "post"))
        .filter((option): option is ResolvedFundingOption => option !== null) ?? [];
    }

    // Before the snapshot table exists, preserve the original profile-level SOL route.
    const { data: post, error } = await supabase
      .from("posts")
      .select("author_wallet")
      .eq("id", targetId as number)
      .maybeSingle();
    if (error || !post?.author_wallet) return [];
    return loadProfileOptions(String(post.author_wallet));
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .select("author_wallet")
    .eq("id", targetId as number)
    .maybeSingle();
  if (error || !comment?.author_wallet) return [];
  return loadProfileOptions(String(comment.author_wallet));
}

export async function resolveFundingOption(
  targetType: FundingTargetType,
  targetId: number | undefined,
  asset: PayoutAsset,
) {
  const options = await resolveTargetFundingOptions(targetType, targetId);
  return options.find((option) => option.asset === asset) ?? null;
}

