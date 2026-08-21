import type {MetadataRoute} from "next";
import {SITE_URL} from "@/lib/config";
import {createPublicSupabase} from "@/lib/supabase/public";

const PAGE_SIZE = 1000;

export const revalidate = 3600;

type PublicSupabase = ReturnType<typeof createPublicSupabase>;

async function getAllPosts(supabase: PublicSupabase) {
    const rows: Array<{id: number; updated_at: string}> = [];
    let lastId = 0;

    for (;;) {
        const {data, error} = await supabase
            .from("posts")
            .select("id, updated_at")
            .gt("id", lastId)
            .order("id", {ascending: true})
            .limit(PAGE_SIZE);
        if (error) throw error;

        const page = (data ?? []) as Array<{id: number; updated_at: string}>;
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
        lastId = page[page.length - 1].id;
    }
}

async function getAllProfiles(supabase: PublicSupabase) {
    const rows: Array<{wallet_address: string; updated_at: string}> = [];
    let lastWallet = "";

    for (;;) {
        let query = supabase
            .from("profiles")
            .select("wallet_address, updated_at")
            .order("wallet_address", {ascending: true})
            .limit(PAGE_SIZE);
        if (lastWallet) query = query.gt("wallet_address", lastWallet);

        const {data, error} = await query;
        if (error) throw error;

        const page = (data ?? []) as Array<{wallet_address: string; updated_at: string}>;
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
        lastWallet = page[page.length - 1].wallet_address;
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${SITE_URL}/about`,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/transparency`,
            changeFrequency: "weekly",
            priority: 0.8,
        },
    ];

    try {
        const supabase = createPublicSupabase();
        const [posts, profiles] = await Promise.all([
            getAllPosts(supabase),
            getAllProfiles(supabase),
        ]);
        return [
            ...staticPages,
            ...posts.map((post) => ({
                url: `${SITE_URL}/p/${post.id}`,
                lastModified: new Date(post.updated_at),
                changeFrequency: "weekly" as const,
                priority: 0.7,
            })),
            ...profiles.map((profile) => ({
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
