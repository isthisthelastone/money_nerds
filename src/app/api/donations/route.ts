import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  type ParsedInstruction,
  type PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireWalletSession } from "@/lib/auth/server";
import { getSolanaRpcUrl } from "@/lib/config";
import {
  apiError,
  readBoundedJsonBody,
  RequestBodyError,
  unauthenticatedResponse,
} from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

interface DonationBody {
  signature?: unknown;
  intentId?: unknown;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function isParsedInstruction(
  value: ParsedInstruction | PartiallyDecodedInstruction,
): value is ParsedInstruction {
  return "parsed" in value;
}

function readMemo(instruction: ParsedInstruction | PartiallyDecodedInstruction) {
  if (!instruction.programId.equals(MEMO_PROGRAM_ID)) return null;
  if (isParsedInstruction(instruction)) {
    if (typeof instruction.parsed === "string") return instruction.parsed;
    if (
      instruction.parsed &&
      typeof instruction.parsed === "object" &&
      "memo" in instruction.parsed &&
      typeof instruction.parsed.memo === "string"
    ) {
      return instruction.parsed.memo;
    }
    return null;
  }

  try {
    return new TextDecoder().decode(bs58.decode(instruction.data));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let donorWallet: string;
  try {
    donorWallet = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  let body: DonationBody | null = null;
  try {
    body = await readBoundedJsonBody<DonationBody>(request, 1_024);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The verification request is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send donation verification details as JSON.", 415);
    }
    return apiError("The verification request could not be read.");
  }
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  const intentId = typeof body?.intentId === "string" ? body.intentId.trim() : "";

  try {
    if (bs58.decode(signature).length !== 64) throw new Error("bad signature");
  } catch {
    return apiError("Invalid Solana transaction signature.");
  }
  if (!UUID_PATTERN.test(intentId)) return apiError("Invalid donation intent.");

  const supabase = createAdminSupabase();
  const { data: intent, error: intentError } = await supabase
    .from("donation_intents")
    .select(
      "id, donor_wallet, recipient_wallet, target_type, post_id, comment_id, lamports, created_at, expires_at, used_signature",
    )
    .eq("id", intentId)
    .eq("donor_wallet", donorWallet)
    .maybeSingle();
  if (intentError || !intent) {
    return apiError("This donation request was not found. Start again from the fund button.", 404);
  }
  if (intent.used_signature) {
    if (intent.used_signature !== signature) {
      return apiError("This donation request was already used.", 409);
    }
    revalidatePath("/");
    revalidatePath(`/u/${donorWallet}`);
    revalidatePath(`/u/${intent.recipient_wallet}`);
    if (intent.target_type === "post" && intent.post_id) {
      revalidatePath(`/p/${intent.post_id}`);
    } else if (intent.target_type === "comment" && intent.comment_id) {
      const { data: comment } = await supabase
        .from("comments")
        .select("post_id")
        .eq("id", intent.comment_id)
        .maybeSingle();
      if (comment?.post_id) revalidatePath(`/p/${comment.post_id}`);
    }
    return NextResponse.json({ verified: true, signature, alreadyRecorded: true });
  }

  const { data: allowed, error: rateError } = await supabase.rpc(
    "consume_wallet_rate_limit",
    {
      p_wallet_address: donorWallet,
      p_action: "donation_verify",
      p_limit: 30,
      p_window_seconds: 60,
    },
  );
  if (rateError) {
    if (rateError.message.includes("Wallet action rate limit exceeded")) {
      return apiError("Too many verification attempts. Wait a minute and retry.", 429);
    }
    console.error("Unable to check donation verification rate", rateError);
    return apiError("Donation verification is temporarily unavailable. Please retry.", 503);
  }
  if (!allowed) {
    return apiError("Too many verification attempts. Wait a minute and retry.", 429);
  }

  const connection = new Connection(getSolanaRpcUrl(), "finalized");
  let transaction = null;
  try {
    for (let attempt = 0; attempt < 6 && !transaction; attempt += 1) {
      transaction = await connection.getParsedTransaction(signature, {
        commitment: "finalized",
        maxSupportedTransactionVersion: 0,
      });
      if (!transaction && attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  } catch (error) {
    console.error("Unable to read finalized Solana donation", error);
    return apiError("Solana verification is temporarily unavailable. Retry—do not send again.", 503);
  }

  if (!transaction || transaction.meta?.err || !transaction.blockTime) {
    return apiError("The transfer is not finalized on Solana yet. Retry verification in a moment.", 409);
  }

  const instructions = transaction.transaction.message.instructions;
  const transferInstructionIndex = instructions.findIndex((instruction) => {
    if (!isParsedInstruction(instruction) || instruction.program !== "system") return false;
    const parsed = instruction.parsed as {
      type?: string;
      info?: { source?: string; destination?: string; lamports?: number };
    };
    return (
      parsed.type === "transfer" &&
      parsed.info?.source === donorWallet &&
      parsed.info?.destination === intent.recipient_wallet &&
      Number(parsed.info?.lamports) === Number(intent.lamports)
    );
  });
  const expectedMemo = `moneynerds:${intent.id}`;
  const hasIntentMemo = instructions.some(
    (instruction) => readMemo(instruction) === expectedMemo,
  );
  if (transferInstructionIndex < 0 || !hasIntentMemo) {
    return apiError("The finalized transfer does not match this Money Nerds donation.", 422);
  }

  const transactionCreatedAt = new Date(transaction.blockTime * 1_000).toISOString();
  const { data: recorded, error: recordError } = await supabase.rpc(
    "record_verified_donation",
    {
      p_intent_id: intent.id,
      p_signature: signature,
      p_instruction_index: transferInstructionIndex,
      p_slot: transaction.slot,
      p_transaction_created_at: transactionCreatedAt,
    },
  );
  if (recordError || !recorded) {
    console.error("Unable to index finalized donation", recordError);
    return apiError(
      "The transfer succeeded, but its public record is still pending. Retry verification—do not send again.",
      409,
      { signature },
    );
  }

  revalidatePath("/");
  revalidatePath(`/u/${donorWallet}`);
  revalidatePath(`/u/${intent.recipient_wallet}`);
  if (intent.target_type === "post" && intent.post_id) {
    revalidatePath(`/p/${intent.post_id}`);
  } else if (intent.target_type === "comment" && intent.comment_id) {
    const { data: comment } = await supabase
      .from("comments")
      .select("post_id")
      .eq("id", intent.comment_id)
      .maybeSingle();
    if (comment?.post_id) revalidatePath(`/p/${comment.post_id}`);
  }

  return NextResponse.json(recorded);
}
