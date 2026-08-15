import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { CATEGORIES } from "@/lib/models";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import {
  cleanupUploadedMedia,
  parseComposerPayload,
  validateUploadedMedia,
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
    const payload = parseComposerPayload(await request.formData());
    if (!CATEGORIES.includes(payload.category as (typeof CATEGORIES)[number])) {
      return apiError("Choose a valid post category.");
    }

    const uploaded = await validateUploadedMedia({
      walletAddress,
      mediaIds: payload.mediaIds,
    });
    const supabase = createAdminSupabase();
    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({
        author_wallet: walletAddress,
        nickname: payload.nickname,
        body: payload.body,
        category: payload.category,
        username: payload.nickname,
        message: payload.body || `[${uploaded[0]?.id ?? "media"}]`,
        walletAddress: walletAddress,
      })
      .select("id")
      .single();

    if (postError || !post) {
      await cleanupUploadedMedia(uploaded);
      throw postError ?? new Error("POST_NOT_CREATED");
    }

    if (uploaded.length) {
      const { error: mediaError } = await supabase.from("post_media").insert(
        uploaded.map((item, position) => ({
          post_id: post.id,
          media_id: item.id,
          position,
        })),
      );
      if (mediaError) {
        await supabase.from("posts").delete().eq("id", post.id);
        await cleanupUploadedMedia(uploaded);
        throw mediaError;
      }
    }

    revalidatePath("/");
    revalidatePath(`/u/${walletAddress}`);
    return NextResponse.json({ id: post.id }, { status: 201 });
  } catch (error) {
    console.error("Unable to create post", error);
    const code = error instanceof Error ? error.message : "";
    const userMessage: Record<string, string> = {
      NICKNAME_REQUIRED: "Add a nickname for this post.",
      MESSAGE_REQUIRED: "Write something or attach media.",
      TOO_MANY_FILES: "Attach no more than four files.",
      INVALID_MEDIA: "Use an image, audio file, or video up to 15 MB.",
      INVALID_MEDIA_KIND: "One attachment type did not match its file.",
      INVALID_MEDIA_METADATA: "Attachment details could not be read.",
      INVALID_MEDIA_OWNER: "One attachment does not belong to this wallet.",
      MEDIA_ALREADY_USED: "One attachment has already been published.",
      MEDIA_UPLOAD_INCOMPLETE: "One attachment did not finish uploading.",
    };
    return apiError(userMessage[code] ?? "Your post could not be published.", 400);
  }
}
