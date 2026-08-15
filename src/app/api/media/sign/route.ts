import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import {
  cleanupUploadedMedia,
  createSignedMediaUploads,
  validateMediaUploadRequest,
} from "@/lib/media/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const body = (await request.json()) as { scope?: unknown; files?: unknown };
    if (body.scope !== "posts" && body.scope !== "comments") {
      return apiError("Invalid upload destination.");
    }
    if (!Array.isArray(body.files)) return apiError("Choose a file to upload.");
    const files = body.files.map(validateMediaUploadRequest);
    const uploads = await createSignedMediaUploads({ walletAddress, scope: body.scope, files });
    return NextResponse.json({ uploads });
  } catch (error) {
    console.error("Unable to sign media upload", error);
    const code = error instanceof Error ? error.message : "";
    const message: Record<string, string> = {
      INVALID_MEDIA: "Use an image, audio file, or video up to 15 MB.",
      INVALID_MEDIA_KIND: "One attachment type did not match its file.",
      TOO_MANY_FILES: "Attach no more than four files.",
    };
    return apiError(message[code] ?? "The upload could not be prepared.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const body = (await request.json()) as { mediaIds?: unknown };
    if (!Array.isArray(body.mediaIds) || !body.mediaIds.every((id) => typeof id === "string")) {
      return apiError("Invalid attachments.");
    }
    const mediaIds = body.mediaIds.slice(0, 4);
    if (!mediaIds.length) return new NextResponse(null, { status: 204 });

    const supabase = createAdminSupabase();
    const { data: assets } = await supabase
      .from("media_assets")
      .select("id, storage_path")
      .eq("owner_wallet", walletAddress)
      .in("id", mediaIds);
    if (assets?.length) {
      const [{ data: postLinks }, { data: commentLinks }] = await Promise.all([
        supabase.from("post_media").select("media_id").in("media_id", mediaIds),
        supabase.from("comment_media").select("media_id").in("media_id", mediaIds),
      ]);
      const linked = new Set([
        ...(postLinks ?? []).map((row) => row.media_id),
        ...(commentLinks ?? []).map((row) => row.media_id),
      ]);
      await cleanupUploadedMedia(
        assets
          .filter((asset) => !linked.has(asset.id))
          .map((asset) => ({ id: asset.id, storagePath: asset.storage_path })),
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unable to clean up media upload", error);
    return apiError("The unfinished upload could not be cleaned up.", 400);
  }
}
