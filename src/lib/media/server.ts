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
const MAX_MEDIA_BYTES_PER_HOUR = 120 * 1024 * 1024;
const MAX_MEDIA_FILES_PER_HOUR = 24;

function startsWith(bytes: Uint8Array, expected: number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return new TextDecoder("ascii").decode(bytes.slice(start, start + length));
}

function hasExpectedMagicBytes(mimeType: string, bytes: Uint8Array) {
  if (bytes.length < 12) return false;
  switch (mimeType) {
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a";
    case "image/webp":
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
    case "image/avif": {
      const header = ascii(bytes, 0, Math.min(bytes.length, 64));
      return ascii(bytes, 4, 4) === "ftyp" && (header.includes("avif") || header.includes("avis"));
    }
    case "audio/ogg":
      return ascii(bytes, 0, 4) === "OggS";
    case "audio/mpeg":
      return ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/wav":
      return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE";
    case "audio/webm":
    case "video/webm":
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mp4":
    case "video/mp4":
    case "video/quicktime":
      return ascii(bytes, 4, 4) === "ftyp";
    default:
      return false;
  }
}

async function readStoragePrefix(storagePath: string) {
  const supabase = createAdminSupabase();
  const { data: signed, error } = await supabase.storage
    .from("media")
    .createSignedUrl(storagePath, 60);
  if (error || !signed?.signedUrl) throw new Error("MEDIA_UPLOAD_INCOMPLETE");

  const response = await fetch(signed.signedUrl, {
    headers: { Range: "bytes=0-63" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok || !response.body) throw new Error("MEDIA_UPLOAD_INCOMPLETE");

  const reader = response.body.getReader();
  const prefix = new Uint8Array(64);
  let length = 0;
  try {
    while (length < prefix.length) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, prefix.length - length);
      prefix.set(chunk, length);
      length += chunk.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return prefix.subarray(0, length);
}

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
  const hourAgo = new Date(Date.now() - 60 * 60 * 1_000).toISOString();
  const { data: recentAssets, error: quotaError } = await supabase
    .from("media_assets")
    .select("size_bytes")
    .eq("owner_wallet", walletAddress)
    .gte("created_at", hourAgo);
  const requestedBytes = files.reduce((sum, file) => sum + file.size, 0);
  const recentBytes = (recentAssets ?? []).reduce(
    (sum, asset) => sum + Number(asset.size_bytes ?? 0),
    0,
  );
  if (
    quotaError ||
    (recentAssets?.length ?? 0) + files.length > MAX_MEDIA_FILES_PER_HOUR ||
    recentBytes + requestedBytes > MAX_MEDIA_BYTES_PER_HOUR
  ) {
    throw new Error("MEDIA_QUOTA_EXCEEDED");
  }
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
      signed.push({ id, storagePath, token: signedUpload.token });
    }

    const { error: assetError } = await supabase.from("media_assets").insert(
      signed.map((upload, index) => ({
        id: upload.id,
        owner_wallet: walletAddress,
        kind: files[index].kind,
        storage_path: upload.storagePath,
        public_url: `/media/${upload.id}`,
        mime_type: files[index].type,
        size_bytes: files[index].size,
        alt_text: files[index].alt || null,
        metadata: {},
      })),
    );
    if (assetError) {
      if (assetError.message.includes("Media upload quota exceeded")) {
        throw new Error("MEDIA_QUOTA_EXCEEDED", { cause: assetError });
      }
      throw assetError;
    }

    created.push(...signed.map(({ id, storagePath }) => ({ id, storagePath })));
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
    .select("id, storage_path, mime_type, size_bytes, status, expires_at")
    .eq("owner_wallet", walletAddress)
    .eq("status", "staged")
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
    if (!asset.expires_at || new Date(asset.expires_at).getTime() <= Date.now()) {
      await cleanupUploadedMedia(uploaded);
      throw new Error("MEDIA_UPLOAD_EXPIRED");
    }
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
    try {
      const prefix = await readStoragePrefix(asset.storage_path);
      if (!hasExpectedMagicBytes(asset.mime_type, prefix)) {
        await cleanupUploadedMedia(uploaded);
        throw new Error("INVALID_MEDIA_CONTENT");
      }
    } catch (error) {
      await cleanupUploadedMedia(uploaded);
      if (error instanceof Error && error.message === "INVALID_MEDIA_CONTENT") throw error;
      throw new Error("MEDIA_UPLOAD_INCOMPLETE");
    }
  }

  return uploaded;
}

export async function cleanupUploadedMedia(uploaded: UploadedMedia[]) {
  if (!uploaded.length) return;
  const supabase = createAdminSupabase();
  const { error: storageError } = await supabase.storage
    .from("media")
    .remove(uploaded.map((item) => item.storagePath));
  if (storageError) {
    console.error("Unable to remove staged media objects", storageError);
    return;
  }
  const { error: rowError } = await supabase.from("media_assets").delete().in(
    "id",
    uploaded.map((item) => item.id),
  );
  if (rowError) console.error("Unable to remove staged media rows", rowError);
}

export async function cleanupExpiredStagedMedia(limit = 50) {
  const supabase = createAdminSupabase();
  const { data: expired } = await supabase
    .from("media_assets")
    .select("id, storage_path")
    .eq("status", "staged")
    .lt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(limit);
  if (!expired?.length) return 0;

  await cleanupUploadedMedia(
    expired.map((asset) => ({ id: asset.id, storagePath: asset.storage_path })),
  );
  return expired.length;
}
