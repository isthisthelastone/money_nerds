import type {MetadataRoute} from "next";
import {createPublicSupabase} from "@/lib/supabase/public";

const SITE_URL = "https://www.moneynerds.online";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const lastModified = new Date();
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
            lastModified,
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${SITE_URL}/about`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/transparency`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    try {
        const supabase = createPublicSupabase();
        const [posts, profiles] = await Promise.all([
            supabase.from("posts").select("id, updated_at").order("id", {ascending: false}),
            supabase.from("profiles").select("wallet_address, updated_at"),
        ]);
        if (posts.error || profiles.error) return staticPages;
        return [
            ...staticPages,
            ...(posts.data ?? []).map((post) => ({
                url: `${SITE_URL}/p/${post.id}`,
                lastModified: new Date(post.updated_at),
                changeFrequency: "weekly" as const,
                priority: 0.7,
            })),
            ...(profiles.data ?? []).map((profile) => ({
                url: `${SITE_URL}/u/${profile.wallet_address}`,
                lastModified: new Date(profile.updated_at),
                changeFrequency: "weekly" as const,
                priority: 0.5,
            })),
        ];
    } catch {
        return staticPages;
    }
}
