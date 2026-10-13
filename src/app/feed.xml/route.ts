import {SITE_URL} from "@/lib/config";
import {createPublicSupabase} from "@/lib/supabase/public";

export const dynamic = "force-static";
export const revalidate = 900;

function xml(value: unknown) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export async function GET() {
    const supabase = createPublicSupabase();
    const {data, error} = await supabase
        .from("post_cards")
        .select("id, nickname, body, created_at, updated_at")
        .order("created_at", {ascending: false})
        .limit(50);
    if (error) return new Response("Feed unavailable", {status: 503});

    const items = (data ?? []).map((post) => {
        const url = `${SITE_URL}/p/${post.id}`;
        const description = String(post.body || "Media post").slice(0, 1000);
        return `<item>
  <title>${xml(`${post.nickname} on Money Nerds`)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${new Date(post.created_at).toUTCString()}</pubDate>
  <dc:creator>${xml(post.nickname)}</dc:creator>
  <description>${xml(description)}</description>
</item>`;
    }).join("\n");

    // Use actual content timestamps; refreshing the cache does not publish news.
    const timestamps = (data ?? []).flatMap((post) => [post.created_at, post.updated_at])
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);
    const lastBuildDate = timestamps.length ? new Date(Math.max(...timestamps)).toUTCString() : null;

    const document = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Money Nerds — public board</title>
  <link>${SITE_URL}</link>
  <description>Public posts receiving direct support across multiple crypto networks.</description>
  <language>en</language>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
  ${lastBuildDate ? `<lastBuildDate>${lastBuildDate}</lastBuildDate>` : ""}
${items}
</channel>
</rss>`;
    return new Response(document, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=0, s-maxage=900, stale-while-revalidate=86400",
        },
    });
}
