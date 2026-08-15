import bs58 from "bs58";
import { Connection, type ParsedInstruction } from "@solana/web3.js";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { getSolanaRpcUrl, SERVICE_WALLET } from "@/lib/config";
import { apiError, unauthenticatedResponse } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

type TargetType = "post" | "comment" | "service";

interface DonationBody {
  signature?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  lamports?: unknown;
}

function isParsedInstruction(value: unknown): value is ParsedInstruction {
  return Boolean(value && typeof value === "object" && "parsed" in value);
}

export async function POST(request: NextRequest) {
  let donorWallet: string;
  try {
    donorWallet = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  const body = (await request.json().catch(() => null)) as DonationBody | null;
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  const targetType = String(body?.targetType ?? "") as TargetType;
  const targetId = Number(body?.targetId);
  const lamports = Number(body?.lamports);

  try {
    if (bs58.decode(signature).length !== 64) throw new Error("bad signature");
  } catch {
    return apiError("Invalid Solana transaction signature.");
  }
  if (!(["post", "comment", "service"] as string[]).includes(targetType)) {
    return apiError("Invalid donation target.");
  }
  if (targetType !== "service" && (!Number.isSafeInteger(targetId) || targetId <= 0)) {
    return apiError("Invalid donation target.");
  }
  if (!Number.isSafeInteger(lamports) || lamports <= 0 || lamports > 100_000 * 1_000_000_000) {
    return apiError("Enter a valid SOL amount.");
  }

  const supabase = createAdminSupabase();
  const { data: existing } = await supabase
    .from("donations")
    .select("signature, donor_wallet, recipient_wallet, lamports")
    .eq("signature", signature)
    .maybeSingle();
  if (existing) {
    if (existing.donor_wallet !== donorWallet || Number(existing.lamports) !== lamports) {
      return apiError("This transaction is already attached to another donation.", 409);
    }
    return NextResponse.json({ verified: true, signature, alreadyRecorded: true });
  }

  let recipientWallet = SERVICE_WALLET;
  if (targetType === "post") {
    const { data: post } = await supabase
      .from("posts")
      .select("author_wallet")
      .eq("id", targetId)
      .maybeSingle();
    if (!post?.author_wallet) return apiError("That post is no longer fundable.", 404);
    recipientWallet = post.author_wallet as string;
  } else if (targetType === "comment") {
    const { data: comment } = await supabase
      .from("comments")
      .select("author_wallet, post_id")
      .eq("id", targetId)
      .maybeSingle();
    if (!comment?.author_wallet) return apiError("That comment is not linked to a wallet.", 404);
    recipientWallet = comment.author_wallet as string;
  }
  if (recipientWallet === donorWallet) {
    return apiError("A wallet cannot fund itself.");
  }

  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  let transaction = null;
  for (let attempt = 0; attempt < 4 && !transaction; attempt += 1) {
    transaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  if (!transaction || transaction.meta?.err) {
    return apiError("The transfer is not confirmed on Solana yet. Retry in a moment.", 409);
  }

  const matchedTransfer = transaction.transaction.message.instructions.some((instruction) => {
    if (!isParsedInstruction(instruction) || instruction.program !== "system") return false;
    const parsed = instruction.parsed as {
      type?: string;
      info?: { source?: string; destination?: string; lamports?: number };
    };
    return (
      parsed.type === "transfer" &&
      parsed.info?.source === donorWallet &&
      parsed.info?.destination === recipientWallet &&
      Number(parsed.info?.lamports) === lamports
    );
  });

  if (!matchedTransfer) {
    return apiError("The confirmed transfer does not match this donation.", 422);
  }

  const { error: insertError } = await supabase.from("donations").insert({
    signature,
    donor_wallet: donorWallet,
    recipient_wallet: recipientWallet,
    target_type: targetType,
    post_id: targetType === "post" ? targetId : null,
    comment_id: targetType === "comment" ? targetId : null,
    lamports,
    slot: transaction.slot,
    status: "verified",
    created_at: transaction.blockTime
      ? new Date(transaction.blockTime * 1000).toISOString()
      : new Date().toISOString(),
  });
  if (insertError) {
    console.error("Unable to index verified donation", insertError);
    return apiError("The transfer succeeded, but its public record is still pending.", 500, {
      signature,
    });
  }

  revalidatePath("/");
  revalidatePath(`/u/${donorWallet}`);
  revalidatePath(`/u/${recipientWallet}`);
  if (targetType === "post") revalidatePath(`/p/${targetId}`);
  return NextResponse.json({ verified: true, signature });
}
