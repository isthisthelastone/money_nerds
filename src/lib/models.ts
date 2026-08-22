export const POST_CATEGORIES = [
  "for-fun",
  "memes",
  "mutual-aid",
  "build",
  "animals",
  "art",
  "crowdfunding",
  "other",
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export const CATEGORIES = ["anything", ...POST_CATEGORIES] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  anything: "Anything",
  "for-fun": "Fun",
  memes: "Memes",
  "mutual-aid": "Mutual Aid",
  build: "Build",
  animals: "Animal Support",
  art: "Art",
  crowdfunding: "Crowdfunding",
  other: "Other",
};

export function isCategory(value: string | undefined): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function isPostCategory(value: string | undefined): value is PostCategory {
  return POST_CATEGORIES.includes(value as PostCategory);
}

export type MediaKind = "image" | "audio" | "video_circle";
export type ExternalIdentityProvider = "google" | "apple" | "telegram";
export type ProfileIdentityKind = "wallet" | "external";
export type AuthProvider = "wallet" | ExternalIdentityProvider;

export const IDENTITY_PROVIDER_LABELS: Record<ExternalIdentityProvider, string> = {
  google: "Google",
  apple: "Apple",
  telegram: "Telegram",
};

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
  author_identity_kind: ProfileIdentityKind;
  author_identity_provider: ExternalIdentityProvider | null;
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
  view_count: number;
  media: MediaAsset[];
}

export interface CommentCardData {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_wallet: string | null;
  author_identity_kind: ProfileIdentityKind | null;
  author_identity_provider: ExternalIdentityProvider | null;
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
  identity_kind: ProfileIdentityKind;
  identity_provider: ExternalIdentityProvider | null;
  display_name: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletProfileStats extends WalletProfile {
  post_count: number;
  comment_count: number;
  likes_given: number;
  verified_donated_lamports: number;
  verified_received_lamports: number;
  legacy_donated_lamports: number;
  legacy_received_lamports: number;
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

export const PROFILE_PAGE_SIZES = [12, 25, 50] as const;
export type ProfilePageSize = (typeof PROFILE_PAGE_SIZES)[number];
export type ProfileActivitySection = "posts" | "comments" | "sent" | "received";

export interface ProfileSectionParams {
  page: number;
  pageSize: ProfilePageSize;
}

export type ProfileActivityParams = Record<ProfileActivitySection, ProfileSectionParams>;

export interface ProfilePage<T> {
  items: T[];
  page: number;
  pageSize: ProfilePageSize;
  total: number;
  totalPages: number;
  from: number;
  to: number;
}

export interface WalletProfileReference {
  wallet_address: string;
  identity_kind: ProfileIdentityKind;
  identity_provider: ExternalIdentityProvider | null;
  display_name: string | null;
}

export interface ProfileDonationRecord extends DonationRecord {
  counterpart_wallet: string;
  counterpart_profile: WalletProfileReference | null;
  target_post_id: number | null;
}

export interface WalletProfileActivity {
  profile: WalletProfile;
  stats: WalletProfileStats;
  posts: ProfilePage<PostCardData>;
  comments: ProfilePage<CommentCardData>;
  sent: ProfilePage<ProfileDonationRecord>;
  received: ProfilePage<ProfileDonationRecord>;
}

export interface WalletSession {
  walletAddress: string;
  profile: WalletProfile | null;
  expiresAt: string;
  authProvider: AuthProvider;
}

export interface FeedParams {
  page: number;
  pageSize: number;
  sort: "latest" | "loved" | "funded";
  category: Category;
}
