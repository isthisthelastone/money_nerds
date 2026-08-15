import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

function parseTarget(request: NextRequest, body?: { targetType?: unknown; targetId?: unknown }) {
  const targetType = String(body?.targetType ?? request.nextUrl.searchParams.get("targetType") ?? "");
  const targetId = Number(body?.targetId ?? request.nextUrl.searchParams.get("targetId"));
  if ((targetType !== "post" && targetType !== "comment") || !Number.isSafeInteger(targetId) || targetId <= 0) {
    return null;
  }
  return { targetType, targetId } as const;
}

export async function GET(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return NextResponse.json({ liked: false });
  }
  const target = parseTarget(request);
  if (!target) return apiError("Invalid like target.");

  const supabase = createAdminSupabase();
  let query = supabase.from("likes").select("id").eq("wallet_address", walletAddress);
  query = target.targetType === "post"
    ? query.eq("post_id", target.targetId)
    : query.eq("comment_id", target.targetId);
  const { data, error } = await query.maybeSingle();
  if (error) return apiError("Like status could not be loaded.", 500);
  return NextResponse.json({ liked: Boolean(data) });
}

export async function POST(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | { targetType?: unknown; targetId?: unknown }
    | null;
  const target = parseTarget(request, body ?? undefined);
  if (!target) return apiError("Invalid like target.");

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("toggle_like_for_wallet", {
    p_wallet_address: walletAddress,
    p_post_id: target.targetType === "post" ? target.targetId : null,
    p_comment_id: target.targetType === "comment" ? target.targetId : null,
  });
  if (error) {
    console.error("Unable to toggle like", error);
    return apiError("The reaction could not be saved.", 500);
  }

  revalidatePath("/");
  if (target.targetType === "post") revalidatePath(`/p/${target.targetId}`);
  return NextResponse.json(data);
}

