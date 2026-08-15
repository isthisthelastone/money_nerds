import { NextResponse } from "next/server";
import {
  getSessionToken,
  getWalletSession,
  hashSessionToken,
} from "@/lib/auth/server";
import { SESSION_COOKIE } from "@/lib/config";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getWalletSession();
  return NextResponse.json({ session });
}

export async function DELETE() {
  const token = await getSessionToken();
  if (token) {
    const supabase = createAdminSupabase();
    await supabase
      .from("wallet_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashSessionToken(token));
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

