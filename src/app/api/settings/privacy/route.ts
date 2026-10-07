import { NextResponse } from "next/server";
import { readBoundedJsonBody } from "@/lib/http";
import { isSameOriginSbpRequest } from "@/lib/sbp-server";
import { CONSENT_COOKIE, PREFERENCE_MAX_AGE } from "@/lib/i18n/config";
import { PRIVACY_VERSION } from "@/lib/privacy";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  if (!isSameOriginSbpRequest(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  let value;
  try { value = await readBoundedJsonBody<{ choice?: unknown }>(request, 128); }
  catch { return NextResponse.json({ error: "Invalid choice." }, { status: 400, headers }); }
  if (!value || typeof value.choice !== "string" || !["all", "necessary"].includes(value.choice) || Object.keys(value).some(key => key !== "choice")) return NextResponse.json({ error: "Invalid choice." }, { status: 400, headers });
  // GPC is honored conservatively. Consent to view counting never authorizes selling/sharing data.
  const choice = request.headers.get("sec-gpc") === "1" ? "necessary" : value.choice;
  const response = NextResponse.json({ choice }, { headers });
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: PREFERENCE_MAX_AGE };
  response.cookies.set(CONSENT_COOKIE, `${PRIVACY_VERSION}.${choice}`, options);
  if (choice === "necessary") response.cookies.set("mn_viewer", "", { ...options, maxAge: 0 });
  return response;
}
