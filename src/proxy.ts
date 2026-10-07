import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/i18n/config";

const DEFAULT_AUTHORIZED_PARTIES = [
  "https://moneynerds.online",
  "https://www.moneynerds.online",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
] as const;

function configuredAuthorizedParties() {
  const configured = (process.env.CLERK_AUTHORIZED_PARTIES ?? "")
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        throw new Error("CLERK_AUTHORIZED_PARTIES must contain absolute origins.");
      }
      const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      if (
        (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("CLERK_AUTHORIZED_PARTIES contains an invalid origin.");
      }
      return url.origin;
    });

  return [...new Set([...DEFAULT_AUTHORIZED_PARTIES, ...configured])];
}

export default clerkMiddleware((_auth, request) => {
  const requestHeaders = new Headers(request.headers);
  // Only URL choices may set this internal rendering hint; ignore caller-supplied headers.
  requestHeaders.delete("x-mn-ui-locale");
  const guideLocale = request.nextUrl.pathname.match(/^\/(en|es|zh|ru|vi)\/how-it-works\/?$/)?.[1];
  const selected = guideLocale ?? request.nextUrl.searchParams.get("ui");
  if (isLocale(selected)) requestHeaders.set("x-mn-ui-locale", selected);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isLocale(selected) && request.cookies.get(LOCALE_COOKIE)?.value !== selected && !request.nextUrl.pathname.startsWith("/api/")) {
    response.cookies.set(LOCALE_COOKIE, selected, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: PREFERENCE_MAX_AGE });
  }
  return response;
}, {
  authorizedParties: configuredAuthorizedParties(),
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
