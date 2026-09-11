// Shared URL validation only: this module must never contain client secrets or
// derive a native deep link. Native links always come intact from Telegram.
export function isTelegramAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4_096) return false;
  try {
    const url = new URL(value);
    return url.origin === "https://oauth.telegram.org" &&
      url.pathname === "/auth" && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

export function isTelegramNativeAuthorizationUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1_024 || /[\u0000-\u0020\u007f]/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    if (url.username || url.password || url.port || url.hash) return false;
    let tokenKey: "token" | "startapp";
    if (url.protocol === "tg:" && url.hostname === "oauth" && !url.pathname) {
      tokenKey = "token";
    } else if (
      url.protocol === "tg:" && url.hostname === "resolve" && !url.pathname &&
      url.searchParams.getAll("domain").length === 1 && url.searchParams.get("domain") === "oauth"
    ) {
      tokenKey = "startapp";
    } else if (url.origin === "https://t.me" && url.pathname === "/oauth") {
      tokenKey = "startapp";
    } else {
      return false;
    }
    const tokens = url.searchParams.getAll(tokenKey);
    return tokens.length === 1 && /^[A-Za-z0-9_-]{1,512}$/.test(tokens[0]);
  } catch {
    return false;
  }
}
