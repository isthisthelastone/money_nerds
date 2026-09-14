import type {MetadataRoute} from "next";
import {CATEGORY_SCOPES} from "@/lib/categories";
import {SITE_URL} from "@/lib/config";
import {GUIDE_LANGUAGES, HOW_IT_WORKS_ALTERNATES} from "@/lib/guide-languages";
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
    const rows: Array<{wallet_address: string}> = [];
    let lastWallet = "";

    for (;;) {
        let query = supabase
            .from("profiles")
            .select("wallet_address")
            .order("wallet_address", {ascending: true})
            .limit(PAGE_SIZE);
        if (lastWallet) query = query.gt("wallet_address", lastWallet);

        const {data, error} = await query;
        if (error) throw error;

        const page = (data ?? []) as Array<{wallet_address: string}>;
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
        lastWallet = page[page.length - 1].wallet_address;
    }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: SITE_URL,
        },
        {
            url: `${SITE_URL}/about`,
        },
        {
            url: `${SITE_URL}/transparency`,
        },
        ...["safety", "faq", "community"].map((path) => ({
            url: `${SITE_URL}/${path}`,
        })),
        ...GUIDE_LANGUAGES.map(({path}) => ({
            url: `${SITE_URL}${path}`,
            alternates: {languages: HOW_IT_WORKS_ALTERNATES},
        })),
        ...CATEGORY_SCOPES.map((category) => ({
            url: `${SITE_URL}/?category=${category.value}`,
        })),
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
            })),
            ...profiles.map((profile) => ({
                url: `${SITE_URL}/u/${encodeURIComponent(profile.wallet_address)}`,
                // Profile updated_at also changes during identity sync and does
                // not track its public activity feed. Do not claim false freshness.
            })),
        ];
    } catch {
        // A transient data failure must not replace the cached complete sitemap
        // with a successful response that silently drops every post and profile.
        console.error("sitemap_generation_failed", {source: "public_content"});
        throw new Error("Unable to generate the public sitemap.");
    }
}
