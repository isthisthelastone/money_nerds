import { clerkMiddleware } from "@clerk/nextjs/server";

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

export default clerkMiddleware({
  authorizedParties: configuredAuthorizedParties(),
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
