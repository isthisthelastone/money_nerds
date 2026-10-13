import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isLocale, LOCALE_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/i18n/config";
import { editorialRoute, localizedPublicPath } from "@/lib/editorial";
import { prefersMarkdown } from "@/lib/markdown-negotiation";

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
  const route = editorialRoute(request.nextUrl.pathname);
  const queryLocale = request.nextUrl.searchParams.get("ui");
  const selected = route?.hasLocalePrefix ? route.locale : queryLocale;
  if (route && ((route.hasLocalePrefix && route.locale === "en") || (!route.hasLocalePrefix && isLocale(queryLocale)))) {
    const target = request.nextUrl.clone();
    target.pathname = localizedPublicPath(route.path, route.hasLocalePrefix ? route.locale : isLocale(queryLocale) ? queryLocale : "en");
    target.searchParams.delete("ui");
    return NextResponse.redirect(target, 308);
  }
  if (isLocale(selected)) requestHeaders.set("x-mn-ui-locale", selected);
  // Editorial language is URL-defined, independent of cookies or browser preferences.
  if (route) requestHeaders.set("x-mn-ui-locale", route.locale);
  const isHomepage = request.nextUrl.pathname === "/";
  const markdown = isHomepage && (request.method === "GET" || request.method === "HEAD")
    && !request.headers.has("rsc") && !request.headers.has("next-router-prefetch")
    && prefersMarkdown(request.headers.get("accept"));
  const target = request.nextUrl.clone();
  target.pathname = "/discover.md";
  const response = markdown
    ? NextResponse.rewrite(target, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  if (isHomepage) {
    const vary = response.headers.get("Vary")?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    if (!vary.some((value) => value === "*" || value.toLowerCase() === "accept")) {
      response.headers.set("Vary", [...vary, "Accept"].join(", "));
    }
  }
  if (isLocale(selected) && request.cookies.get(LOCALE_COOKIE)?.value !== selected && !request.nextUrl.pathname.startsWith("/api/")) {
    response.cookies.set(LOCALE_COOKIE, selected, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: PREFERENCE_MAX_AGE });
  }
  return response;
}, {
  authorizedParties: configuredAuthorizedParties(),
});

export const config = {
  matcher: [
    "/((?!_next|media/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
