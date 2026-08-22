import "server-only";

import { SITE_URL } from "@/lib/config";

export const INDEXNOW_KEY = "2ce9c49553724a8f84d20756b02f1abc";

export async function notifyIndexNow(paths: string[]) {
  const site = new URL(SITE_URL);
  const urlList = [...new Set(paths)]
    .map((path) => new URL(path, site).toString())
    .filter((url) => new URL(url).origin === site.origin);
  if (!urlList.length) return false;

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key: INDEXNOW_KEY,
        keyLocation: `${site.origin}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}
