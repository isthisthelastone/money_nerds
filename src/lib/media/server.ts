import "server-only";

import { randomUUID } from "node:crypto";
import { MAX_MEDIA_BYTES, MAX_MEDIA_PER_MESSAGE } from "@/lib/config";
import type { MediaKind } from "@/lib/models";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const MEDIA_KIND_BY_MIME: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/avif": "image",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "video/webm": "video_circle",
  "video/mp4": "video_circle",
  "video/quicktime": "video_circle",
};

export const MEDIA_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export interface UploadedMedia {
  id: string;
  storagePath: string;
}

export interface MediaUploadRequest {
  name: string;
  type: string;
  size: number;
  kind: MediaKind;
  alt: string;
}

export interface ParsedComposerPayload {
  nickname: string;
  body: string;
  category: string;
  mediaIds: string[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseComposerPayload(formData: FormData): ParsedComposerPayload {
  const nickname = String(formData.get("nickname") ?? "").trim().slice(0, 50);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  const category = String(formData.get("category") ?? "anything").trim();

  let mediaIds: string[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("mediaIds") ?? "[]")) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === "string")) {
      throw new Error("INVALID_MEDIA_METADATA");
    }
    mediaIds = [...new Set(parsed)];
  } catch {
    throw new Error("INVALID_MEDIA_METADATA");
  }

  if (!nickname) throw new Error("NICKNAME_REQUIRED");
  if (!body && mediaIds.length === 0) throw new Error("MESSAGE_REQUIRED");
  if (mediaIds.length > MAX_MEDIA_PER_MESSAGE) throw new Error("TOO_MANY_FILES");
  if (mediaIds.some((id) => !UUID_PATTERN.test(id))) throw new Error("INVALID_MEDIA_METADATA");

  return { nickname, body, category, mediaIds };
}

export function validateMediaUploadRequest(value: unknown): MediaUploadRequest {
  if (!value || typeof value !== "object") throw new Error("INVALID_MEDIA");
  const candidate = value as Partial<MediaUploadRequest>;
  const type = String(candidate.type ?? "").toLowerCase();
  const kind = candidate.kind;
  const size = Number(candidate.size);
  const detectedKind = MEDIA_KIND_BY_MIME[type];

  if (!detectedKind || kind !== detectedKind) throw new Error("INVALID_MEDIA_KIND");
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_MEDIA_BYTES) {
    throw new Error("INVALID_MEDIA");
  }

  return {
    name: String(candidate.name ?? "attachment").slice(0, 255),
    type,
    size,
    kind,
    alt: String(candidate.alt ?? "").trim().slice(0, 500),
  };
}

export async function createSignedMediaUploads({
  walletAddress,
  scope,
  files,
}: {
  walletAddress: string;
  scope: "posts" | "comments";
  files: MediaUploadRequest[];
}) {
  if (files.length < 1 || files.length > MAX_MEDIA_PER_MESSAGE) {
    throw new Error(files.length ? "TOO_MANY_FILES" : "INVALID_MEDIA");
  }

  const supabase = createAdminSupabase();
  const created: UploadedMedia[] = [];
  const signed: Array<UploadedMedia & { token: string }> = [];

  try {
    for (const file of files) {
      const id = randomUUID();
      const extension = MEDIA_EXTENSION_BY_MIME[file.type];
      const storagePath = `${walletAddress}/${scope}/${id}.${extension}`;
      const { data: signedUpload, error: signedError } = await supabase.storage
        .from("media")
        .createSignedUploadUrl(storagePath, { upsert: false });
      if (signedError || !signedUpload) throw signedError ?? new Error("UPLOAD_NOT_SIGNED");

      const publicUrl = supabase.storage.from("media").getPublicUrl(storagePath).data.publicUrl;
      const { error: assetError } = await supabase.from("media_assets").insert({
        id,
        owner_wallet: walletAddress,
        kind: file.kind,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
        alt_text: file.alt || null,
        metadata: { original_name: file.name },
      });
      if (assetError) throw assetError;

      created.push({ id, storagePath });
      signed.push({ id, storagePath, token: signedUpload.token });
    }
    return signed;
  } catch (error) {
    await cleanupUploadedMedia(created);
    throw error;
  }
}

export async function validateUploadedMedia({
  walletAddress,
  mediaIds,
}: {
  walletAddress: string;
  mediaIds: string[];
}): Promise<UploadedMedia[]> {
  if (!mediaIds.length) return [];
  if (mediaIds.length > MAX_MEDIA_PER_MESSAGE || mediaIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error("INVALID_MEDIA_METADATA");
  }

  const supabase = createAdminSupabase();
  const { data: assets, error } = await supabase
    .from("media_assets")
    .select("id, storage_path, mime_type, size_bytes")
    .eq("owner_wallet", walletAddress)
    .in("id", mediaIds);
  if (error || !assets || assets.length !== mediaIds.length) {
    throw error ?? new Error("INVALID_MEDIA_OWNER");
  }

  const [{ data: postLinks }, { data: commentLinks }] = await Promise.all([
    supabase.from("post_media").select("media_id").in("media_id", mediaIds),
    supabase.from("comment_media").select("media_id").in("media_id", mediaIds),
  ]);
  if ((postLinks?.length ?? 0) + (commentLinks?.length ?? 0) > 0) {
    throw new Error("MEDIA_ALREADY_USED");
  }

  const uploaded = assets.map((asset) => ({ id: asset.id, storagePath: asset.storage_path }));
  for (const asset of assets) {
    const { data: info, error: infoError } = await supabase.storage
      .from("media")
      .info(asset.storage_path);
    if (
      infoError ||
      !info ||
      info.size !== Number(asset.size_bytes) ||
      info.contentType !== asset.mime_type
    ) {
      await cleanupUploadedMedia(uploaded);
      throw new Error("MEDIA_UPLOAD_INCOMPLETE");
    }
  }

  return uploaded;
}

export async function cleanupUploadedMedia(uploaded: UploadedMedia[]) {
  if (!uploaded.length) return;
  const supabase = createAdminSupabase();
  await supabase.storage.from("media").remove(uploaded.map((item) => item.storagePath));
  await supabase.from("media_assets").delete().in(
    "id",
    uploaded.map((item) => item.id),
  );
}
