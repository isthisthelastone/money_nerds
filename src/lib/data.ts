import "server-only";

import { cache } from "react";
import { parseJsonArray } from "@/lib/format";
import type {
  CommentCardData,
  DonationRecord,
  FeedParams,
  MediaAsset,
  PostCardData,
  WalletProfile,
} from "@/lib/models";
import { createPublicSupabase } from "@/lib/supabase/public";

function normalizePost(row: Record<string, unknown>): PostCardData {
  return {
    id: Number(row.id),
    author_wallet: String(row.author_wallet),
    nickname: String(row.nickname ?? "Anonymous nerd"),
    body: String(row.body ?? ""),
    category: String(row.category ?? "anything"),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
    legacy_image_url: row.legacy_image_url ? String(row.legacy_image_url) : null,
    like_count: Number(row.like_count ?? 0),
    legacy_like_count: Number(row.legacy_like_count ?? 0),
    verified_donation_lamports: Number(row.verified_donation_lamports ?? 0),
    legacy_donation_lamports: Number(row.legacy_donation_lamports ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    media: parseJsonArray<MediaAsset>(row.media),
  };
}

function normalizeComment(row: Record<string, unknown>): CommentCardData {
  return {
    id: Number(row.id),
    post_id: Number(row.post_id),
    parent_id: row.parent_id ? Number(row.parent_id) : null,
    author_wallet: row.author_wallet ? String(row.author_wallet) : null,
    legacy_author_label: row.legacy_author_label ? String(row.legacy_author_label) : null,
    nickname: String(row.nickname ?? "Anonymous nerd"),
    body: String(row.body ?? ""),
    created_at: String(row.created_at),
    like_count: Number(row.like_count ?? 0),
    verified_donation_lamports: Number(row.verified_donation_lamports ?? 0),
    media: parseJsonArray<MediaAsset>(row.media),
  };
}

export async function getFeed(params: FeedParams) {
  const supabase = createPublicSupabase();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;
  let query = supabase.from("post_cards").select("*", { count: "exact" });
  if (params.category !== "anything") query = query.eq("category", params.category);

  const sortColumn =
    params.sort === "loved"
      ? "like_count"
      : params.sort === "funded"
        ? "verified_donation_lamports"
        : "created_at";
  query = query
    .order(sortColumn, { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);
  const { data, count, error } = await query;
  if (error) throw new Error(`Unable to load the feed: ${error.message}`);
  return {
    posts: (data ?? []).map((row) => normalizePost(row as Record<string, unknown>)),
    count: count ?? 0,
  };
}

export const getPost = cache(async (id: number) => {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.from("post_cards").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Unable to load post: ${error.message}`);
  return data ? normalizePost(data as Record<string, unknown>) : null;
});

export const getComments = cache(async (postId: number) => {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("comment_cards")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(250);
  if (error) throw new Error(`Unable to load comments: ${error.message}`);
  return (data ?? []).map((row) => normalizeComment(row as Record<string, unknown>));
});

export const getProfileActivity = cache(async (walletAddress: string) => {
  const supabase = createPublicSupabase();
  const [profileResult, postsResult, commentsResult, sentResult, receivedResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("wallet_address, display_name, bio, created_at, updated_at")
      .eq("wallet_address", walletAddress)
      .maybeSingle(),
    supabase
      .from("post_cards")
      .select("*")
      .eq("author_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("comment_cards")
      .select("*")
      .eq("author_wallet", walletAddress)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("donations")
      .select("signature, donor_wallet, recipient_wallet, post_id, comment_id, target_type, lamports, slot, status, created_at")
      .eq("donor_wallet", walletAddress)
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("donations")
      .select("signature, donor_wallet, recipient_wallet, post_id, comment_id, target_type, lamports, slot, status, created_at")
      .eq("recipient_wallet", walletAddress)
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const error =
    profileResult.error ||
    postsResult.error ||
    commentsResult.error ||
    sentResult.error ||
    receivedResult.error;
  if (error) throw new Error(`Unable to load wallet profile: ${error.message}`);
  if (!profileResult.data) return null;

  return {
    profile: profileResult.data as WalletProfile,
    posts: (postsResult.data ?? []).map((row) => normalizePost(row as Record<string, unknown>)),
    comments: (commentsResult.data ?? []).map((row) => normalizeComment(row as Record<string, unknown>)),
    sent: (sentResult.data ?? []) as DonationRecord[],
    received: (receivedResult.data ?? []) as DonationRecord[],
  };
});

export async function getSiteStats() {
  const supabase = createPublicSupabase();
  const [posts, profiles, donations] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("wallet_address", { count: "exact", head: true }),
    supabase.from("donations").select("lamports").eq("status", "verified"),
  ]);
  return {
    posts: posts.count ?? 0,
    profiles: profiles.count ?? 0,
    verifiedLamports: (donations.data ?? []).reduce((sum, row) => sum + Number(row.lamports ?? 0), 0),
  };
}

