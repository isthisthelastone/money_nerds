import { NextResponse } from "next/server";
import {
  getSessionToken,
  getWalletSession,
  hashSessionToken,
} from "@/lib/auth/server";
import { SESSION_COOKIE } from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const legacyToken = await getSessionToken();
  const session = await getWalletSession();
  const response = NextResponse.json({ session });
  if (session && legacyToken) {
    const supabase = createAdminSupabase();
    await supabase.rpc("revoke_wallet_session", {
      p_token_hash: hashSessionToken(legacyToken),
    });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE() {
  const token = await getSessionToken();
  if (token) {
    const supabase = createAdminSupabase();
    const { error } = await supabase.rpc("revoke_wallet_session", {
      p_token_hash: hashSessionToken(token),
    });
    if (error) {
      console.error("Unable to revoke wallet session", error);
      return NextResponse.json(
        { error: "The wallet session could not be closed. Please retry." },
        { status: 503 },
      );
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
