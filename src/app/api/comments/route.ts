import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import {
  cleanupUploadedMedia,
  parseComposerPayload,
  validateUploadedMedia,
} from "@/lib/media/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { CommentCardData, MediaAsset } from "@/lib/models";
import { parseJsonArray } from "@/lib/format";

export async function GET(request: NextRequest) {
  const postId = Number(request.nextUrl.searchParams.get("postId"));
  if (!Number.isSafeInteger(postId) || postId <= 0) return apiError("Invalid post.");

  const supabase = createPublicSupabase();
  const { data, error } = await supabase
    .from("comment_cards")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(250);

  if (error) return apiError("Comments could not be loaded.", 500);
  const comments = (data ?? []).map((row) => ({
    ...row,
    like_count: Number(row.like_count ?? 0),
    verified_donation_lamports: Number(row.verified_donation_lamports ?? 0),
    media: parseJsonArray<MediaAsset>(row.media),
  })) as CommentCardData[];
  return NextResponse.json({ comments });
}

export async function POST(request: NextRequest) {
  let walletAddress: string;
  try {
    walletAddress = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  try {
    const formData = await request.formData();
    const postId = Number(formData.get("postId"));
    const parentIdValue = Number(formData.get("parentId"));
    const parentId = Number.isSafeInteger(parentIdValue) && parentIdValue > 0 ? parentIdValue : null;
    if (!Number.isSafeInteger(postId) || postId <= 0) return apiError("Invalid post.");

    const payload = parseComposerPayload(formData);
    const supabase = createAdminSupabase();
    const { data: post } = await supabase.from("posts").select("id").eq("id", postId).maybeSingle();
    if (!post) return apiError("That post no longer exists.", 404);

    if (parentId) {
      const { data: parent } = await supabase
        .from("comments")
        .select("id")
        .eq("id", parentId)
        .eq("post_id", postId)
        .maybeSingle();
      if (!parent) return apiError("The comment you replied to no longer exists.", 404);
    }

    const uploaded = await validateUploadedMedia({
      walletAddress,
      mediaIds: payload.mediaIds,
    });
    const { data: comment, error: commentError } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        parent_id: parentId,
        author_wallet: walletAddress,
        nickname: payload.nickname,
        body: payload.body,
        user_id: walletAddress,
        user_nickname: payload.nickname,
        content: payload.body || `[${uploaded[0]?.id ?? "media"}]`,
      })
      .select("id")
      .single();

    if (commentError || !comment) {
      await cleanupUploadedMedia(uploaded);
      throw commentError ?? new Error("COMMENT_NOT_CREATED");
    }

    if (uploaded.length) {
      const { error: mediaError } = await supabase.from("comment_media").insert(
        uploaded.map((item, position) => ({
          comment_id: comment.id,
          media_id: item.id,
          position,
        })),
      );
      if (mediaError) {
        await supabase.from("comments").delete().eq("id", comment.id);
        await cleanupUploadedMedia(uploaded);
        throw mediaError;
      }
    }

    revalidatePath("/");
    revalidatePath(`/p/${postId}`);
    revalidatePath(`/u/${walletAddress}`);
    return NextResponse.json({ id: comment.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to create comment", error);
    const code = error instanceof Error ? error.message : "";
    const userMessage: Record<string, string> = {
      NICKNAME_REQUIRED: "Add a nickname for this comment.",
      MESSAGE_REQUIRED: "Write something or attach media.",
      TOO_MANY_FILES: "Attach no more than four files.",
      INVALID_MEDIA: "Use an image, audio file, or video up to 15 MB.",
      INVALID_MEDIA_METADATA: "Attachment details could not be read.",
      INVALID_MEDIA_OWNER: "One attachment does not belong to this wallet.",
      MEDIA_ALREADY_USED: "One attachment has already been published.",
      MEDIA_UPLOAD_INCOMPLETE: "One attachment did not finish uploading.",
    };
    return apiError(userMessage[code] ?? "Your comment could not be published.", 400);
  }
}
