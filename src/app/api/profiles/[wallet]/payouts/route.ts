import { NextResponse } from "next/server";
import {
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  payoutRouteMatches,
  type PayoutAsset,
} from "@/lib/funding/payouts";
import { apiError } from "@/lib/http";
import { createPublicSupabase } from "@/lib/supabase/public";

interface PayoutRow {
  id: unknown;
  profile_wallet: unknown;
  chain_namespace: unknown;
  network_reference: unknown;
  asset: unknown;
  recipient_address: unknown;
  verification_status: unknown;
  verified_at: unknown;
  created_at: unknown;
}
interface PublicPayoutOption {
  id: string;
  profileWallet: string;
  asset: PayoutAsset;
  address: string;
  verificationStatus: "self_declared" | "verified";
  verifiedAt: string | null;
  createdAt: string;
  config: (typeof PAYOUT_ASSET_CONFIG)[PayoutAsset];
}

function readPayoutOption(row: PayoutRow): PublicPayoutOption | null {
  const asset = typeof row.asset === "string" ? row.asset : "";
  const chainNamespace = typeof row.chain_namespace === "string" ? row.chain_namespace : "";
  const networkReference = typeof row.network_reference === "string" ? row.network_reference : "";
  const address = typeof row.recipient_address === "string" ? row.recipient_address : "";
  const verificationStatus =
    row.verification_status === "self_declared" || row.verification_status === "verified"
      ? row.verification_status
      : null;
  if (
    typeof row.id !== "string" ||
    typeof row.profile_wallet !== "string" ||
    typeof row.created_at !== "string" ||
    !verificationStatus ||
    !(
      row.verified_at === null ||
      row.verified_at === undefined ||
      typeof row.verified_at === "string"
    ) ||
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
    verificationStatus,
    verifiedAt: typeof row.verified_at === "string" ? row.verified_at : null,
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
    .from("profile_funding_routes")
    .select(
      "id, profile_wallet, chain_namespace, network_reference, asset, recipient_address, verification_status, verified_at, created_at",
    )
    .eq("profile_wallet", profileWallet)
    .in("verification_status", ["self_declared", "verified"])
    .order("asset", { ascending: true })
    .order("verified_at", { ascending: false });

  if (error) {
    console.error("Unable to load profile funding options", error);
    return apiError("Funding options are temporarily unavailable.", 503);
  }

  const options = (data as PayoutRow[] | null | undefined)
    ?.map(readPayoutOption)
    .filter((option): option is PublicPayoutOption => option !== null) ?? [];

  return NextResponse.json(
    { profileWallet, options },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
