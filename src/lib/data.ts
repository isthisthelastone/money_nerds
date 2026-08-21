import "server-only";

import { cache } from "react";
import { parseJsonArray } from "@/lib/format";
import { PROFILE_PAGE_SIZES } from "@/lib/models";
import type {
  CommentCardData,
  DonationRecord,
  FeedParams,
  MediaAsset,
  PostCardData,
  ProfileActivityParams,
  ProfileActivitySection,
  ProfileDonationRecord,
  ProfilePage,
  ProfilePageSize,
  WalletProfile,
  WalletProfileActivity,
  WalletProfileReference,
  WalletProfileStats,
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

function normalizeDonation(row: Record<string, unknown>): DonationRecord {
  const targetType =
    row.target_type === "post" || row.target_type === "comment"
      ? row.target_type
      : "service";
  return {
    signature: String(row.signature),
    donor_wallet: String(row.donor_wallet),
    recipient_wallet: String(row.recipient_wallet),
    post_id: row.post_id === null || row.post_id === undefined ? null : Number(row.post_id),
    comment_id:
      row.comment_id === null || row.comment_id === undefined ? null : Number(row.comment_id),
    target_type: targetType,
    lamports: Number(row.lamports),
    slot: row.slot === null || row.slot === undefined ? null : Number(row.slot),
    status: "verified",
    created_at: String(row.created_at),
  };
}

export const DEFAULT_PROFILE_ACTIVITY_PARAMS: ProfileActivityParams = {
  posts: { page: 1, pageSize: 12 },
  comments: { page: 1, pageSize: 12 },
  sent: { page: 1, pageSize: 12 },
  received: { page: 1, pageSize: 12 },
};

interface ProfilePageWindow {
  page: number;
  pageSize: ProfilePageSize;
  total: number;
  totalPages: number;
  offset: number;
  end: number;
}

function profilePageWindow(
  requested: ProfileActivityParams[ProfileActivitySection] | undefined,
  total: number,
): ProfilePageWindow {
  const requestedSize = Number(requested?.pageSize);
  const pageSize = PROFILE_PAGE_SIZES.includes(
    requestedSize as ProfilePageSize,
  )
    ? (requestedSize as ProfilePageSize)
    : 12;
  const requestedPage = Number(requested?.page);
  const safeRequestedPage =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(safeRequestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total,
    totalPages,
    offset,
    end: offset + pageSize - 1,
  };
}

function profilePage<T>(items: T[], window: ProfilePageWindow): ProfilePage<T> {
  return {
    items,
    page: window.page,
    pageSize: window.pageSize,
    total: window.total,
    totalPages: window.totalPages,
    from: items.length ? window.offset + 1 : 0,
    to: items.length ? window.offset + items.length : 0,
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
    .order("id", { ascending: true })
    .limit(25);
  if (error) throw new Error(`Unable to load comments: ${error.message}`);
  return (data ?? []).map((row) => normalizeComment(row as Record<string, unknown>));
});

export const getWalletProfile = cache(async (walletAddress: string) => {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("wallet_address, display_name, bio, created_at, updated_at")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  if (error) throw new Error(`Unable to load wallet profile: ${error.message}`);
  return data ? (data as WalletProfile) : null;
});

export const getProfileActivity = cache(
  async (
    walletAddress: string,
    requestedParams: ProfileActivityParams = DEFAULT_PROFILE_ACTIVITY_PARAMS,
  ): Promise<WalletProfileActivity | null> => {
    const profile = await getWalletProfile(walletAddress);
    if (!profile) return null;

    const supabase = createPublicSupabase();
    const [statsResult, postsCount, commentsCount, sentCount, receivedCount] = await Promise.all([
      supabase
        .from("profile_stats")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle(),
      supabase
        .from("post_cards")
        .select("id", { count: "exact", head: true })
        .eq("author_wallet", walletAddress),
      supabase
        .from("comment_cards")
        .select("id", { count: "exact", head: true })
        .eq("author_wallet", walletAddress),
      supabase
        .from("donations")
        .select("signature", { count: "exact", head: true })
        .eq("donor_wallet", walletAddress)
        .eq("status", "verified"),
      supabase
        .from("donations")
        .select("signature", { count: "exact", head: true })
        .eq("recipient_wallet", walletAddress)
        .eq("status", "verified"),
    ]);
    const countError =
      statsResult.error ||
      postsCount.error ||
      commentsCount.error ||
      sentCount.error ||
      receivedCount.error;
    if (countError) throw new Error(`Unable to load wallet profile: ${countError.message}`);

    const windows = {
      posts: profilePageWindow(requestedParams.posts, postsCount.count ?? 0),
      comments: profilePageWindow(requestedParams.comments, commentsCount.count ?? 0),
      sent: profilePageWindow(requestedParams.sent, sentCount.count ?? 0),
      received: profilePageWindow(requestedParams.received, receivedCount.count ?? 0),
    };
    const donationFields =
      "signature, donor_wallet, recipient_wallet, post_id, comment_id, target_type, lamports, slot, status, created_at";
    const [postsResult, commentsResult, sentResult, receivedResult] = await Promise.all([
      supabase
        .from("post_cards")
        .select("*")
        .eq("author_wallet", walletAddress)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(windows.posts.offset, windows.posts.end),
      supabase
        .from("comment_cards")
        .select("*")
        .eq("author_wallet", walletAddress)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(windows.comments.offset, windows.comments.end),
      supabase
        .from("donations")
        .select(donationFields)
        .eq("donor_wallet", walletAddress)
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .order("signature", { ascending: false })
        .range(windows.sent.offset, windows.sent.end),
      supabase
        .from("donations")
        .select(donationFields)
        .eq("recipient_wallet", walletAddress)
        .eq("status", "verified")
        .order("created_at", { ascending: false })
        .order("signature", { ascending: false })
        .range(windows.received.offset, windows.received.end),
    ]);
    const pageError =
      postsResult.error || commentsResult.error || sentResult.error || receivedResult.error;
    if (pageError) throw new Error(`Unable to load wallet activity: ${pageError.message}`);

    const posts = (postsResult.data ?? []).map((row) =>
      normalizePost(row as Record<string, unknown>),
    );
    const comments = (commentsResult.data ?? []).map((row) =>
      normalizeComment(row as Record<string, unknown>),
    );
    const sent = (sentResult.data ?? []).map((row) =>
      normalizeDonation(row as Record<string, unknown>),
    );
    const received = (receivedResult.data ?? []).map((row) =>
      normalizeDonation(row as Record<string, unknown>),
    );
    const counterpartWallets = Array.from(
      new Set([
        ...sent.map((donation) => donation.recipient_wallet),
        ...received.map((donation) => donation.donor_wallet),
      ]),
    );
    const commentIds = Array.from(
      new Set(
        [...sent, ...received]
          .filter((donation) => donation.target_type === "comment")
          .map((donation) => donation.comment_id)
          .filter((id): id is number => id !== null),
      ),
    );

    const loadCounterpartProfiles = async (): Promise<WalletProfileReference[]> => {
      if (!counterpartWallets.length) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("wallet_address, display_name")
        .in("wallet_address", counterpartWallets);
      if (error) throw new Error(`Unable to resolve donation wallets: ${error.message}`);
      return (data ?? []) as WalletProfileReference[];
    };
    const loadCommentTargets = async (): Promise<Array<{ id: number; post_id: number }>> => {
      if (!commentIds.length) return [];
      const { data, error } = await supabase
        .from("comment_cards")
        .select("id, post_id")
        .in("id", commentIds);
      if (error) throw new Error(`Unable to resolve donation targets: ${error.message}`);
      return (data ?? []).map((row) => ({ id: Number(row.id), post_id: Number(row.post_id) }));
    };
    const [counterpartProfiles, commentTargets] = await Promise.all([
      loadCounterpartProfiles(),
      loadCommentTargets(),
    ]);
    const profileByWallet = new Map(
      counterpartProfiles.map((counterpart) => [counterpart.wallet_address, counterpart]),
    );
    const postByComment = new Map(
      commentTargets.map((target) => [target.id, target.post_id]),
    );
    const enrichDonation = (
      donation: DonationRecord,
      direction: "sent" | "received",
    ): ProfileDonationRecord => {
      const counterpartWallet =
        direction === "sent" ? donation.recipient_wallet : donation.donor_wallet;
      return {
        ...donation,
        counterpart_wallet: counterpartWallet,
        counterpart_profile: profileByWallet.get(counterpartWallet) ?? null,
        target_post_id:
          donation.target_type === "post"
            ? donation.post_id
            : donation.target_type === "comment" && donation.comment_id
              ? (postByComment.get(donation.comment_id) ?? null)
              : null,
      };
    };

    const rawStats = statsResult.data as Record<string, unknown> | null;
    const stats: WalletProfileStats = {
      ...profile,
      post_count: Number(rawStats?.post_count ?? 0),
      comment_count: Number(rawStats?.comment_count ?? 0),
      likes_given: Number(rawStats?.likes_given ?? 0),
      verified_donated_lamports: Number(rawStats?.verified_donated_lamports ?? 0),
      verified_received_lamports: Number(rawStats?.verified_received_lamports ?? 0),
      legacy_donated_lamports: Number(rawStats?.legacy_donated_lamports ?? 0),
      legacy_received_lamports: Number(rawStats?.legacy_received_lamports ?? 0),
    };

    return {
      profile,
      stats,
      posts: profilePage(posts, windows.posts),
      comments: profilePage(comments, windows.comments),
      sent: profilePage(
        sent.map((donation) => enrichDonation(donation, "sent")),
        windows.sent,
      ),
      received: profilePage(
        received.map((donation) => enrichDonation(donation, "received")),
        windows.received,
      ),
    };
  },
);

export async function getSiteStats() {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.from("site_stats").select("*").single();
  if (error) throw new Error(`Unable to load site statistics: ${error.message}`);
  return {
    posts: Number(data.post_count ?? 0),
    profiles: Number(data.profile_count ?? 0),
    verifiedLamports: Number(data.verified_donation_lamports ?? 0),
  };
}
