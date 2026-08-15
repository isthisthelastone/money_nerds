export const CATEGORIES = [
  "anything",
  "for-fun",
  "mutual-aid",
  "build",
  "animals",
  "art",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type MediaKind = "image" | "audio" | "video_circle";

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  public_url: string;
  mime_type: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  position?: number;
}

export interface PostCardData {
  id: number;
  author_wallet: string;
  nickname: string;
  body: string;
  category: Category | string;
  created_at: string;
  updated_at: string;
  legacy_image_url: string | null;
  like_count: number;
  legacy_like_count: number;
  verified_donation_lamports: number;
  legacy_donation_lamports: number;
  comment_count: number;
  media: MediaAsset[];
}

export interface CommentCardData {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_wallet: string | null;
  legacy_author_label: string | null;
  nickname: string;
  body: string;
  created_at: string;
  like_count: number;
  verified_donation_lamports: number;
  media: MediaAsset[];
}

export interface WalletProfile {
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface DonationRecord {
  signature: string;
  donor_wallet: string;
  recipient_wallet: string;
  post_id: number | null;
  comment_id: number | null;
  target_type: "post" | "comment" | "service";
  lamports: number;
  slot: number | null;
  status: "verified";
  created_at: string;
}

export interface WalletSession {
  walletAddress: string;
  profile: WalletProfile | null;
  expiresAt: string;
}

export interface FeedParams {
  page: number;
  pageSize: number;
  sort: "latest" | "loved" | "funded";
  category: string;
}

