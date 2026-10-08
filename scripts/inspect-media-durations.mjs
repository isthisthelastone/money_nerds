// Read-only inspection. No file overwrite or schema change, no tokens in output.
import { Input, UrlSource, ALL_FORMATS } from "mediabunny";
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from("media_assets").select("id,kind,public_url,size_bytes").eq("status", "published").in("kind", ["audio", "video_circle"]).is("duration_seconds", null).limit(25);
if (error) throw new Error("Media lookup failed");
for (const asset of data) {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(new URL(asset.public_url, "https://www.moneynerds.online"), { getRetryDelay: () => null, maxCacheSize: 16 * 1024 * 1024 }) });
  const timer = setTimeout(() => input.dispose(), 30_000);
  try {
    const duration = await input.computeDuration();
    const track = await input.getPrimaryVideoTrack();
    console.log(JSON.stringify({ id: asset.id, kind: asset.kind, bytes: asset.size_bytes, duration: Math.round(duration * 1000) / 1000, width: track ? await track.getDisplayWidth() : null, height: track ? await track.getDisplayHeight() : null }));
  } catch { console.log(JSON.stringify({ id: asset.id, status: "Could not inspect" })); }
  finally { clearTimeout(timer); input.dispose(); }
}
