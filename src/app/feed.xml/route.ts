import {SITE_URL} from "@/lib/config";
import {createPublicSupabase} from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

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
        .select("id, nickname, body, author_wallet, created_at")
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
  <author>${xml(post.author_wallet)}</author>
  <description>${xml(description)}</description>
</item>`;
    }).join("\n");

    const document = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Money Nerds — public board</title>
  <link>${SITE_URL}</link>
  <description>Wallet-native posts receiving direct support in SOL.</description>
  <language>en</language>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
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
