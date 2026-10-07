import { NextResponse } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { readBoundedJsonBody } from "@/lib/http";
import { isSameOriginSbpRequest } from "@/lib/sbp-server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { COUNTRY_COOKIE, isLegalCountry, isLocale, LOCALE_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export async function PATCH(request: Request) {
  const fail = (status: number) => NextResponse.json({ error: "Preferences could not be saved. Try again." }, { status, headers: responseHeaders });
  if (!isSameOriginSbpRequest(request)) return fail(403);
  let input: Record<string, unknown>;
  try {
    const body = await readBoundedJsonBody(request, 1024);
    if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400);
    input = body as Record<string, unknown>;
  } catch { return fail(400); }
  if (!Object.keys(input).length || Object.keys(input).some((key) => !["locale", "country"].includes(key))) return fail(400);
  if (("locale" in input && input.locale !== null && !isLocale(input.locale)) || ("country" in input && input.country !== null && !isLegalCountry(input.country))) return fail(400);

  let session;
  try { session = await requireWalletSession(); }
  catch (error) {
    if (!(error instanceof Error && error.message === "UNAUTHENTICATED")) return fail(503);
  }
  if (session) {
    const { error } = await createAdminSupabase().from("profile_preferences").upsert({
      wallet_address: session.walletAddress,
      ...("locale" in input ? { locale: input.locale } : {}),
      ...("country" in input ? { legal_country: input.country } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: "wallet_address", defaultToNull: false });
    if (error) return fail(503);
  }
  const response = NextResponse.json({ saved: true, account: Boolean(session) }, { headers: responseHeaders });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: PREFERENCE_MAX_AGE };
  for (const [key, cookie] of [["locale", LOCALE_COOKIE], ["country", COUNTRY_COOKIE]] as const) {
    if (key in input) response.cookies.set(cookie, typeof input[key] === "string" ? input[key] : "", { ...options, maxAge: input[key] === null ? 0 : PREFERENCE_MAX_AGE });
  }
  return response;
}
