import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { SERVICE_WALLET } from "@/lib/config";
import {
  apiError,
  readBoundedJsonBody,
  RequestBodyError,
  unauthenticatedResponse,
} from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

type TargetType = "post" | "comment" | "service";

interface IntentBody {
  targetType?: unknown;
  targetId?: unknown;
  lamports?: unknown;
}

export async function POST(request: NextRequest) {
  let donorWallet: string;
  try {
    donorWallet = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  let body: IntentBody | null = null;
  try {
    body = await readBoundedJsonBody<IntentBody>(request, 1_024);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The donation request is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send donation details as JSON.", 415);
    }
    return apiError("The donation request could not be read.");
  }

  const targetType = String(body?.targetType ?? "") as TargetType;
  const targetId = Number(body?.targetId);
  const lamports = Number(body?.lamports);
  if (!(targetType === "post" || targetType === "comment" || targetType === "service")) {
    return apiError("Invalid donation target.");
  }
  if (targetType !== "service" && (!Number.isSafeInteger(targetId) || targetId <= 0)) {
    return apiError("Invalid donation target.");
  }
  if (!Number.isSafeInteger(lamports) || lamports <= 0 || lamports > 100_000_000_000_000) {
    return apiError("Enter a valid SOL amount.");
  }

  const supabase = createAdminSupabase();
  let recipientWallet = SERVICE_WALLET;
  if (targetType === "post") {
    const { data: post } = await supabase
      .from("posts")
      .select("author_wallet")
      .eq("id", targetId)
      .maybeSingle();
    if (!post?.author_wallet) return apiError("That post is no longer fundable.", 404);
    recipientWallet = String(post.author_wallet);
  } else if (targetType === "comment") {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_wallet")
      .eq("id", targetId)
      .maybeSingle();
    if (!comment?.author_wallet) {
      return apiError("That comment is not linked to a fundable wallet.", 404);
    }
    recipientWallet = String(comment.author_wallet);
  }

  if (recipientWallet === donorWallet) return apiError("A wallet cannot fund itself.");

  const { data, error } = await supabase.rpc("issue_donation_intent", {
    p_donor_wallet: donorWallet,
    p_recipient_wallet: recipientWallet,
    p_target_type: targetType,
    p_post_id: targetType === "post" ? targetId : null,
    p_comment_id: targetType === "comment" ? targetId : null,
    p_lamports: lamports,
  });
  if (error || !data) {
    console.error("Unable to issue donation intent", error);
    const rateLimited = error?.message.includes("rate limit");
    return apiError(
      rateLimited
        ? "Too many donation attempts. Wait a minute and try again."
        : "The donation could not be prepared. Please try again.",
      rateLimited ? 429 : 500,
    );
  }

  const intent = data as {
    id?: string;
    recipient_wallet?: string;
    lamports?: number;
    expires_at?: string;
  };
  if (!intent.id || !intent.recipient_wallet || !intent.expires_at) {
    return apiError("The donation could not be prepared. Please try again.", 500);
  }

  // Opportunistic cleanup keeps private, expired rows bounded without requiring
  // a paid scheduler on the Supabase free tier.
  await supabase.rpc("prune_expired_private_rows");

  return NextResponse.json(
    {
      id: intent.id,
      recipientWallet: intent.recipient_wallet,
      lamports: Number(intent.lamports),
      expiresAt: intent.expires_at,
    },
    { status: 201 },
  );
}
