import { NextResponse, type NextRequest } from "next/server";
import {
  resolveTargetFundingOptions,
  type FundingTargetType,
} from "@/lib/funding/server";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const targetType = request.nextUrl.searchParams.get("targetType") as FundingTargetType | null;
  const rawTargetId = request.nextUrl.searchParams.get("targetId");
  const targetId = rawTargetId ? Number(rawTargetId) : undefined;
  if (targetType !== "post" && targetType !== "comment" && targetType !== "service") {
    return apiError("Invalid funding target.");
  }
  if (
    targetType !== "service" &&
    (!Number.isSafeInteger(targetId) || Number(targetId) <= 0)
  ) {
    return apiError("Invalid funding target.");
  }

  const options = await resolveTargetFundingOptions(targetType, targetId);
  if (!options.length) {
    return apiError("This request has no active funding routes yet.", 404);
  }

  return NextResponse.json(
    {
      targetType,
      targetId: targetType === "service" ? null : targetId,
      options: options.map((option) => ({
        id: option.id,
        asset: option.asset,
        address: option.address,
        verificationStatus: option.verificationStatus,
        chainNamespace: option.chainNamespace,
        networkReference: option.networkReference,
        symbol: option.config.symbol,
        networkName: option.config.networkName,
        decimals: option.config.decimals,
        tokenContract: option.config.contractAddress,
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

