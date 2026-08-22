import { NextResponse } from "next/server";
import {
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  payoutRouteMatches,
  type VerifiedPayoutOption,
} from "@/lib/funding/payouts";
import { apiError } from "@/lib/http";
import { createPublicSupabase } from "@/lib/supabase/public";

interface PayoutRow {
  id: unknown;
  profile_wallet: unknown;
  chain_namespace: unknown;
  network_reference: unknown;
  asset: unknown;
  normalized_address: unknown;
  verified_at: unknown;
  created_at: unknown;
}
function readPayoutOption(row: PayoutRow): VerifiedPayoutOption | null {
  const asset = typeof row.asset === "string" ? row.asset : "";
  const chainNamespace = typeof row.chain_namespace === "string" ? row.chain_namespace : "";
  const networkReference = typeof row.network_reference === "string" ? row.network_reference : "";
  const address = typeof row.normalized_address === "string" ? row.normalized_address : "";
  if (
    typeof row.id !== "string" ||
    typeof row.profile_wallet !== "string" ||
    typeof row.verified_at !== "string" ||
    typeof row.created_at !== "string" ||
    !isPayoutAsset(asset) ||
    !payoutRouteMatches(asset, chainNamespace, networkReference) ||
    normalizePayoutAddress(asset, address) !== address
  ) {
    return null;
  }
  return {
    id: row.id,
    profileWallet: row.profile_wallet,
    asset,
    address,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    config: PAYOUT_ASSET_CONFIG[asset],
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ wallet: string }> },
) {
  const { wallet: requestedWallet } = await context.params;
  const profileWallet = normalizePayoutAddress("SOL", requestedWallet);
  if (!profileWallet) return apiError("Invalid profile wallet.");

  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("verified_payout_accounts")
    .select(
      "id, profile_wallet, chain_namespace, network_reference, asset, normalized_address, verified_at, created_at",
    )
    .eq("profile_wallet", profileWallet)
    .order("asset", { ascending: true })
    .order("verified_at", { ascending: false });

  if (error) {
    console.error("Unable to load verified payout options", error);
    return apiError("Verified payout options are temporarily unavailable.", 503);
  }

  const options = (data as PayoutRow[] | null | undefined)
    ?.map(readPayoutOption)
    .filter((option): option is VerifiedPayoutOption => option !== null) ?? [];

  return NextResponse.json(
    { profileWallet, options },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
      },
    },
  );
}
