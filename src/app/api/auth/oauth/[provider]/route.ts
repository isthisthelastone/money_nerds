import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  createExternalAuthTransaction,
  createMemoryAuthStorage,
  createPkceSupabase,
  encodeExternalAuthTransaction,
  externalTransactionCookieOptions,
  getExternalProviderAvailability,
  OAUTH_TRANSACTION_COOKIE,
  oauthCallbackUrl,
  requireExternalProvider,
} from "@/lib/auth/external";
import { isOAuthProvider } from "@/lib/auth/external-core";
import { getSupabaseUrl } from "@/lib/config";
import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { provider } = await context.params;
  if (!isOAuthProvider(provider)) return apiError("Unsupported authentication provider.", 404);

  const availability = getExternalProviderAvailability(provider);
  if (!availability.available) {
    console.warn("External OAuth provider is unavailable", { provider, reason: availability.reason });
    return apiError(`${provider} login is unavailable.`, 503, {
      provider,
      available: false,
    });
  }

  const rate = await checkExternalAuthRateLimit(request, "external_auth_start", 15);
  if (!rate.ok) {
    return apiError(
      rate.limited ? "Too many login attempts. Wait a minute and try again." : "Login is temporarily unavailable.",
      rate.limited ? 429 : 503,
    );
  }

  try {
    requireExternalProvider(provider);
    const transaction = createExternalAuthTransaction(provider, request.nextUrl.searchParams.get("returnTo"));
    const memory = createMemoryAuthStorage();
    const supabase = createPkceSupabase(memory.storage);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: oauthCallbackUrl(provider, transaction.state),
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) return apiError(`${provider} login could not be started.`, 503);

    const authorizeUrl = new URL(data.url);
    const supabaseOrigin = new URL(getSupabaseUrl()).origin;
    if (authorizeUrl.origin !== supabaseOrigin || authorizeUrl.pathname !== "/auth/v1/authorize") {
      return apiError(`${provider} login returned an invalid authorization URL.`, 503);
    }

    transaction.authStorage = memory.snapshot();
    const response = NextResponse.redirect(authorizeUrl, 302);
    response.cookies.set(
      OAUTH_TRANSACTION_COOKIE,
      encodeExternalAuthTransaction(transaction),
      externalTransactionCookieOptions("/api/auth/oauth"),
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return apiError(`${provider} login is not configured correctly.`, 503);
  }
}
