import { requireWalletSession } from "@/lib/auth/server";
import { readBoundedJsonBody } from "@/lib/http";
import { isSbpBankId } from "@/lib/sbp";
import { isSameOriginSbpRequest, sbpResponse } from "@/lib/sbp-server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function postId(context: Context) {
  const { id } = await context.params;
  const value = Number(id);
  return /^[1-9][0-9]*$/.test(id) && Number.isSafeInteger(value) ? value : null;
}

export async function GET(_request: Request, context: Context) {
  const id = await postId(context);
  if (!id) return sbpResponse({ available: false });
  const session = await requireWalletSession().catch(() => null);
  if (!session) return sbpResponse({ available: false });
  const { data, error } = await createAdminSupabase().rpc("get_post_sbp_transfer", {
    p_post_id: id, p_viewer_wallet: session.walletAddress, p_bank_id: null,
  });
  if (error) return sbpResponse({ error: "SBP is temporarily unavailable." }, 503);
  return sbpResponse(data ?? { available: false });
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginSbpRequest(request)) return sbpResponse({ error: "Open this post on Money Nerds to continue." }, 403);
  const session = await requireWalletSession().catch(() => null);
  if (!session) return sbpResponse({ error: "Sign in to view transfer instructions." }, 401);
  const id = await postId(context);
  if (!id) return sbpResponse({ error: "SBP transfer instructions are unavailable." }, 404);
  let bankId;
  try {
    const body = await readBoundedJsonBody<unknown>(request, 256);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
        !("bankId" in body) || !isSbpBankId(body.bankId)) throw new Error("INVALID_BANK");
    bankId = body.bankId;
  } catch {
    return sbpResponse({ error: "Choose a receiving bank." }, 400);
  }
  const supabase = createAdminSupabase();
  const { error: rateError } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: session.walletAddress,
    p_action: "reveal_sbp_transfer", p_limit: 60, p_window_seconds: 600,
  });
  if (rateError) {
    const limited = rateError.message.includes("Wallet action rate limit exceeded");
    return sbpResponse({ error: limited ? "Too many requests. Try again in a few minutes." : "SBP is temporarily unavailable." }, limited ? 429 : 503);
  }
  const { data, error } = await supabase.rpc("get_post_sbp_transfer", {
    p_post_id: id, p_viewer_wallet: session.walletAddress, p_bank_id: bankId,
  });
  if (error) return sbpResponse({ error: "SBP is temporarily unavailable." }, 503);
  if (!data) return sbpResponse({ error: "SBP is unavailable. Both people must enable it, and the author must include it in this post." }, 404);
  return sbpResponse(data);
}
