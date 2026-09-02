import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  clearExternalTransactionCookie,
  decodeExternalAuthTransaction,
  externalAuthRedirect,
  getExternalAuthOrigin,
  getExternalProviderAvailability,
  getTelegramBotToken,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import {
  constantTimeStringEqual,
  parseTelegramLoginPayload,
  verifyTelegramLogin,
} from "@/lib/auth/external-core";
import { apiError, readBoundedJsonBody, RequestBodyError } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ state: string }> };

type CallbackResult =
  | { ok: true; signInUrl: string; returnTo: string }
  | { ok: false; code: string; returnTo: string };

function clearTransaction(response: NextResponse) {
  clearExternalTransactionCookie(response, TELEGRAM_TRANSACTION_COOKIE, "/api/auth/telegram");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function telegramName(value: string | undefined) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, 256) : undefined;
}

async function verifyCallback(
  request: NextRequest,
  state: string,
  payload: unknown,
): Promise<CallbackResult> {
  const availability = getExternalProviderAvailability("telegram");
  if (!availability.available) return { ok: false, code: "provider_unavailable", returnTo: "/" };

  let transaction;
  try {
    transaction = decodeExternalAuthTransaction(request.cookies.get(TELEGRAM_TRANSACTION_COOKIE)?.value);
  } catch {
    return { ok: false, code: "provider_unavailable", returnTo: "/" };
  }
  if (
    !transaction ||
    transaction.provider !== "telegram" ||
    !constantTimeStringEqual(transaction.state, state) ||
    transaction.createdAt > Date.now() + 30_000 ||
    transaction.createdAt < Date.now() - 10 * 60 * 1_000
  ) {
    return { ok: false, code: "invalid_callback", returnTo: transaction?.returnTo ?? "/" };
  }

  const rate = await checkExternalAuthRateLimit(request, "external_auth_callback", 30);
  if (!rate.ok) {
    return {
      ok: false,
      code: rate.limited ? "too_many_requests" : "temporarily_unavailable",
      returnTo: transaction.returnTo,
    };
  }

  const verified = verifyTelegramLogin(payload, getTelegramBotToken());
  if (!verified.ok) {
    return {
      ok: false,
      code: verified.code === "expired" ? "expired" : "invalid_callback",
      returnTo: transaction.returnTo,
    };
  }

  try {
    const telegram = parseTelegramLoginPayload(payload);
    if (!telegram) return { ok: false, code: "invalid_callback", returnTo: transaction.returnTo };
    const client = await clerkClient();
    const externalId = `telegram:${verified.subject}`;
    let users = await client.users.getUserList({ externalId: [externalId], limit: 2 });
    if (users.totalCount > 1) {
      return { ok: false, code: "temporarily_unavailable", returnTo: transaction.returnTo };
    }
    let user = users.data.at(0);
    if (!user) {
      try {
        user = await client.users.createUser({
          externalId,
          firstName: telegramName(telegram.first_name),
          lastName: telegramName(telegram.last_name),
          skipPasswordRequirement: true,
        });
      } catch {
        // A concurrent callback may have created the same immutable Telegram
        // identity. Re-read by unique externalId and continue only if it exists.
        users = await client.users.getUserList({ externalId: [externalId], limit: 2 });
        user = users.totalCount === 1 ? users.data.at(0) : undefined;
      }
    }
    if (!user) {
      return { ok: false, code: "temporarily_unavailable", returnTo: transaction.returnTo };
    }
    const ticket = await client.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 60,
    });
    const signInUrl = new URL(ticket.url);
    if (signInUrl.protocol !== "https:" || signInUrl.username || signInUrl.password) {
      return { ok: false, code: "temporarily_unavailable", returnTo: transaction.returnTo };
    }
    signInUrl.searchParams.set(
      "redirect_url",
      new URL(transaction.returnTo, getExternalAuthOrigin()).href,
    );
    return {
      ok: true,
      signInUrl: signInUrl.href,
      returnTo: transaction.returnTo,
    };
  } catch {
    return { ok: false, code: "temporarily_unavailable", returnTo: transaction.returnTo };
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { state } = await context.params;
  if (request.url.length > 4_096) {
    return clearTransaction(NextResponse.redirect(externalAuthRedirect("/", "error", "invalid_callback"), 303));
  }
  const payload = Object.fromEntries(request.nextUrl.searchParams);
  const result = await verifyCallback(request, state, payload);
  if (!result.ok) {
    return clearTransaction(
      NextResponse.redirect(externalAuthRedirect(result.returnTo, "error", result.code), 303),
    );
  }

  return clearTransaction(NextResponse.redirect(result.signInUrl, 303));
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { state } = await context.params;
  let payload: unknown;
  try {
    payload = await readBoundedJsonBody<unknown>(request, 4_096);
  } catch (error) {
    const response =
      error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE"
        ? apiError("The Telegram login response is too large.", 413)
        : error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE"
          ? apiError("Send Telegram login details as JSON.", 415)
          : apiError("The Telegram login response could not be read.");
    return clearTransaction(response);
  }

  const result = await verifyCallback(request, state, payload);
  if (!result.ok) return clearTransaction(apiError("Telegram login could not be verified.", 401, { code: result.code }));

  return clearTransaction(NextResponse.json({ redirectUrl: result.signInUrl }));
}
