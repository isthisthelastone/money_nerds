import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import {
  buildPaymentUri,
  isPayoutAsset,
  isValidAtomicAmount,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  type PayoutAsset,
} from "@/lib/funding/payouts";
import {
  resolveFundingOption,
  type FundingTargetType,
  type ResolvedFundingOption,
} from "@/lib/funding/server";
import {
  apiError,
  readBoundedJsonBody,
  RequestBodyError,
  unauthenticatedResponse,
} from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

interface IntentBody {
  targetType?: unknown;
  targetId?: unknown;
  asset?: unknown;
  atomicAmount?: unknown;
  senderAddress?: unknown;
  /** Compatibility with the previous SOL-only client. */
  lamports?: unknown;
}

interface FundingIntentResult {
  id?: unknown;
  asset?: unknown;
  chain_namespace?: unknown;
  network_reference?: unknown;
  token_contract?: unknown;
  recipient_address?: unknown;
  amount_atomic?: unknown;
  expires_at?: unknown;
}

function readAtomicAmount(body: IntentBody, asset: PayoutAsset) {
  const legacyLamports = Number(body.lamports);
  const raw = typeof body.atomicAmount === "string"
    ? body.atomicAmount.trim()
    : asset === "SOL" && Number.isSafeInteger(legacyLamports)
      ? String(legacyLamports)
      : "";
  return isValidAtomicAmount(raw) ? raw : null;
}

function normalizeSender(asset: PayoutAsset, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? normalizePayoutAddress(asset, value) : null;
}

async function issueLegacySolIntent(
  donorProfile: string,
  targetType: FundingTargetType,
  targetId: number | undefined,
  atomicAmount: string,
  option: ResolvedFundingOption,
) {
  const lamports = Number(atomicAmount);
  if (!Number.isSafeInteger(lamports) || lamports > 100_000_000_000_000) return null;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("issue_donation_intent", {
    p_donor_wallet: donorProfile,
    p_recipient_wallet: option.address,
    p_target_type: targetType,
    p_post_id: targetType === "post" ? targetId : null,
    p_comment_id: targetType === "comment" ? targetId : null,
    p_lamports: lamports,
  });
  if (error || !data) return null;
  const result = data as { id?: unknown; recipient_wallet?: unknown; lamports?: unknown; expires_at?: unknown };
  if (
    typeof result.id !== "string" ||
    typeof result.recipient_wallet !== "string" ||
    typeof result.expires_at !== "string"
  ) return null;
  return {
    id: result.id,
    asset: "SOL" as const,
    chainNamespace: PAYOUT_ASSET_CONFIG.SOL.chainNamespace,
    networkReference: PAYOUT_ASSET_CONFIG.SOL.networkReference,
    tokenContract: null,
    recipientAddress: result.recipient_wallet,
    atomicAmount: String(result.lamports),
    expiresAt: result.expires_at,
  };
}

export async function POST(request: NextRequest) {
  let donorProfile: string;
  try {
    // This is the canonical app profile. It is intentionally independent from
    // the wallet/account that signs the selected network transaction.
    donorProfile = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  let body: IntentBody;
  try {
    body = await readBoundedJsonBody<IntentBody>(request, 2_048);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The funding request is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send funding details as JSON.", 415);
    }
    return apiError("The funding request could not be read.");
  }

  const targetType = String(body.targetType ?? "") as FundingTargetType;
  const targetId = body.targetId === null || body.targetId === undefined
    ? undefined
    : Number(body.targetId);
  const requestedAsset = typeof body.asset === "string" ? body.asset : "SOL";
  if (targetType !== "post" && targetType !== "comment" && targetType !== "service") {
    return apiError("Invalid funding target.");
  }
  if (
    targetType !== "service" &&
    (!Number.isSafeInteger(targetId) || Number(targetId) <= 0)
  ) {
    return apiError("Invalid funding target.");
  }
  if (!isPayoutAsset(requestedAsset)) return apiError("Choose a supported asset and network.");
  const atomicAmount = readAtomicAmount(body, requestedAsset);
  if (!atomicAmount) {
    return apiError(`Enter a valid ${PAYOUT_ASSET_CONFIG[requestedAsset].symbol} amount.`);
  }
  const senderAddress = normalizeSender(requestedAsset, body.senderAddress);
  if (body.senderAddress && !senderAddress) return apiError("The sending wallet address is invalid.");

  const option = await resolveFundingOption(targetType, targetId, requestedAsset);
  if (!option) return apiError("That asset is not enabled for this request.", 409);
  if (senderAddress && senderAddress === option.address) {
    return apiError("A wallet cannot fund itself.");
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("issue_funding_intent", {
    p_donor_profile_wallet: donorProfile,
    p_sender_address: senderAddress,
    p_target_type: targetType,
    p_amount_atomic: atomicAmount,
    p_post_id: targetType === "post" ? targetId : null,
    p_comment_id: targetType === "comment" ? targetId : null,
    p_post_funding_option_id: option.postFundingOptionId,
    p_profile_funding_route_id: option.profileFundingRouteId,
    p_service_asset: targetType === "service" ? requestedAsset : null,
    p_service_recipient_address: targetType === "service" ? option.address : null,
  });

  if (error || !data) {
    // Keep the pre-migration SOL path alive during the atomic app/schema deploy.
    if (requestedAsset === "SOL") {
      const legacy = await issueLegacySolIntent(
        donorProfile,
        targetType,
        targetId,
        atomicAmount,
        option,
      );
      if (legacy) {
        return NextResponse.json(
          {
            ...legacy,
            paymentUri: buildPaymentUri(
              legacy.asset,
              legacy.recipientAddress,
              legacy.atomicAmount,
              legacy.id,
            ),
          },
          { status: 201 },
        );
      }
    }
    console.error("Unable to issue funding intent", { code: error?.code });
    const rateLimited = error?.message.toLowerCase().includes("rate limit");
    return apiError(
      rateLimited
        ? "Too many funding attempts. Wait a minute and try again."
        : "The direct payment could not be prepared. Please try again.",
      rateLimited ? 429 : 503,
    );
  }

  const result = data as FundingIntentResult;
  const resultAsset = typeof result.asset === "string" ? result.asset : "";
  const recipientAddress = typeof result.recipient_address === "string"
    ? result.recipient_address
    : "";
  const resultAmount = String(result.amount_atomic ?? "");
  if (
    typeof result.id !== "string" ||
    resultAsset !== requestedAsset ||
    recipientAddress !== option.address ||
    resultAmount !== atomicAmount ||
    typeof result.expires_at !== "string"
  ) {
    return apiError("The direct payment could not be prepared. Please try again.", 500);
  }

  await supabase.rpc("prune_expired_private_rows");
  return NextResponse.json(
    {
      id: result.id,
      asset: requestedAsset,
      chainNamespace: result.chain_namespace,
      networkReference: result.network_reference,
      tokenContract: result.token_contract ?? null,
      recipientAddress,
      atomicAmount: resultAmount,
      expiresAt: result.expires_at,
      paymentUri: buildPaymentUri(requestedAsset, recipientAddress, resultAmount, result.id),
    },
    { status: 201 },
  );
}
