import { NextResponse, type NextRequest } from "next/server";
import {
  checkExternalAuthRateLimit,
  clearExternalTransactionCookie,
  decodeExternalAuthTransaction,
  establishExternalSession,
  externalAuthRedirect,
  getExternalProviderAvailability,
  getTelegramBotToken,
  setExternalSessionCookie,
  TELEGRAM_TRANSACTION_COOKIE,
} from "@/lib/auth/external";
import { constantTimeStringEqual, verifyTelegramLogin } from "@/lib/auth/external-core";
import { apiError, readBoundedJsonBody, RequestBodyError } from "@/lib/http";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ state: string }> };

type CallbackResult =
  | { ok: true; established: Awaited<ReturnType<typeof establishExternalSession>>; returnTo: string }
  | { ok: false; code: string; returnTo: string };

function clearTransaction(response: NextResponse) {
  clearExternalTransactionCookie(response, TELEGRAM_TRANSACTION_COOKIE, "/api/auth/telegram");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
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
    return {
      ok: true,
      established: await establishExternalSession("telegram", verified.subject),
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

  const response = NextResponse.redirect(externalAuthRedirect(result.returnTo, "success", "telegram"), 303);
  setExternalSessionCookie(response, result.established);
  return clearTransaction(response);
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

  const response = NextResponse.json({ session: result.established.session });
  setExternalSessionCookie(response, result.established);
  return clearTransaction(response);
}
