import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  clearExternalTransactionCookie,
  createMemoryAuthStorage,
  createPkceSupabase,
  decodeExternalAuthTransaction,
  establishExternalSession,
  externalAuthRedirect,
  getExternalProviderAvailability,
  OAUTH_TRANSACTION_COOKIE,
  setExternalSessionCookie,
} from "@/lib/auth/external";
import { constantTimeStringEqual, isOAuthProvider } from "@/lib/auth/external-core";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string; state: string }> };

function callbackResponse(returnTo: unknown, result: "success" | "error", code: string) {
  const response = NextResponse.redirect(externalAuthRedirect(returnTo, result, code), 303);
  clearExternalTransactionCookie(response, OAUTH_TRANSACTION_COOKIE, "/api/auth/oauth");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { provider, state } = await context.params;
  if (!isOAuthProvider(provider)) return apiError("Unsupported authentication provider.", 404);

  const availability = getExternalProviderAvailability(provider);
  if (!availability.available) {
    console.warn("External OAuth callback is unavailable", { provider, reason: availability.reason });
    return apiError(`${provider} login is unavailable.`, 503);
  }

  let transaction;
  try {
    transaction = decodeExternalAuthTransaction(request.cookies.get(OAUTH_TRANSACTION_COOKIE)?.value);
  } catch {
    return apiError(`${provider} login is not configured correctly.`, 503);
  }
  if (
    !transaction ||
    transaction.provider !== provider ||
    !constantTimeStringEqual(transaction.state, state) ||
    transaction.createdAt > Date.now() + 30_000 ||
    transaction.createdAt < Date.now() - 10 * 60 * 1_000
  ) {
    return callbackResponse(transaction?.returnTo, "error", "invalid_callback");
  }

  if (request.nextUrl.searchParams.has("error")) {
    return callbackResponse(transaction.returnTo, "error", "provider_denied");
  }
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code || code.length > 2_048 || /[\u0000-\u001f]/.test(code)) {
    return callbackResponse(transaction.returnTo, "error", "invalid_callback");
  }

  const rate = await checkExternalAuthRateLimit(request, "external_auth_callback", 30);
  if (!rate.ok) {
    return callbackResponse(
      transaction.returnTo,
      "error",
      rate.limited ? "too_many_requests" : "temporarily_unavailable",
    );
  }

  const memory = createMemoryAuthStorage(transaction.authStorage);
  const supabase = createPkceSupabase(memory.storage);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const identity = data.user?.identities?.find((candidate) => candidate.provider === provider);
  const subject = identity?.id;
  if (data.session) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (error || typeof subject !== "string" || !subject) {
    return callbackResponse(transaction.returnTo, "error", "invalid_callback");
  }

  try {
    const established = await establishExternalSession(provider, subject);
    const response = callbackResponse(transaction.returnTo, "success", provider);
    setExternalSessionCookie(response, established);
    return response;
  } catch {
    return callbackResponse(transaction.returnTo, "error", "temporarily_unavailable");
  }
}
