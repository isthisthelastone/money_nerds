import { requireWalletSession } from "@/lib/auth/server";
import { readBoundedJsonBody } from "@/lib/http";
import { getOwnSbpSettings, isSameOriginSbpRequest, parseSbpSettings, sbpBodyError, sbpResponse } from "@/lib/sbp-server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireWalletSession().catch(() => null);
  if (!session) return sbpResponse({ error: "Sign in to manage SBP settings." }, 401);
  try {
    return sbpResponse(await getOwnSbpSettings(session.walletAddress));
  } catch {
    return sbpResponse({ error: "SBP settings are temporarily unavailable." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginSbpRequest(request)) return sbpResponse({ error: "Open settings on Money Nerds to make changes." }, 403);
  const session = await requireWalletSession().catch(() => null);
  if (!session) return sbpResponse({ error: "Sign in to manage SBP settings." }, 401);
  let settings;
  try {
    settings = parseSbpSettings(await readBoundedJsonBody(request, 16 * 1024));
  } catch (error) {
    return sbpBodyError(error);
  }
  const { error } = await createAdminSupabase().rpc("save_sbp_settings", {
    p_wallet_address: session.walletAddress,
    p_enabled: settings.enabled,
    p_phone: settings.phone,
    p_banks: settings.banks,
  });
  if (error) return sbpResponse({ error: "SBP settings could not be saved. Try again." }, 503);
  return sbpResponse(settings);
}
