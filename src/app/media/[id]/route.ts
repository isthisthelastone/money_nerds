import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: RouteParams }) {
  const id = (await params).id;
  if (!UUID_PATTERN.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = createAdminSupabase();
  const { data: asset, error } = await supabase
    .from("media_assets")
    .select("storage_path, status")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error || !asset) return new NextResponse(null, { status: 404 });

  const { data: signed, error: signError } = await supabase.storage
    .from("media")
    .createSignedUrl(asset.storage_path, 300);
  if (signError || !signed?.signedUrl) {
    return new NextResponse(null, { status: 503 });
  }

  const response = NextResponse.redirect(signed.signedUrl, 307);
  response.headers.set("Cache-Control", "public, max-age=30, s-maxage=240");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
