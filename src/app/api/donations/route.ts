import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  type PayoutAsset,
} from "@/lib/funding/payouts";
import {
  apiError,
  readBoundedJsonBody,
  RequestBodyError,
  unauthenticatedResponse,
} from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

interface DonationBody {
  transactionId?: unknown;
  signature?: unknown;
  intentId?: unknown;
}

interface FundingIntentRow {
  id: string;
  donor_profile_wallet: string;
  recipient_profile_wallet: string | null;
  target_type: "post" | "comment" | "service";
  post_id: number | null;
  comment_id: number | null;
  chain_namespace: string;
  network_reference: string;
  asset: PayoutAsset;
  token_contract: string | null;
  amount_atomic: string;
  sender_address: string;
  recipient_address: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_transaction_hash: string | null;
  used_transfer_index: number | null;
}

interface VerifiedTransfer {
  transactionHash: string;
  transferIndex: number;
  blockHeight: number | null;
  blockTime: string;
  senderAddress: string;
  recipientAddress: string;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code?: number; message?: string };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVM_HASH_PATTERN = /^0x[0-9a-f]{64}$/;
const HEX_64_PATTERN = /^[0-9a-f]{64}$/;
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
    ) return instruction.parsed.memo;
    return null;
  }
  try {
    return new TextDecoder().decode(bs58.decode(instruction.data));
  } catch {
    return null;
  }
}

function normalizeTransactionId(asset: PayoutAsset, input: string) {
  const value = input.trim();
  const namespace = PAYOUT_ASSET_CONFIG[asset].chainNamespace;
  if (namespace === "solana") {
    try {
      return bs58.decode(value).length === 64 ? value : null;
    } catch {
      return null;
    }
  }
  if (namespace === "eip155") {
    const normalized = value.toLowerCase();
    return EVM_HASH_PATTERN.test(normalized) ? normalized : null;
  }
  if (namespace === "ton") {
    const normalizedHex = value.toLowerCase();
    if (HEX_64_PATTERN.test(normalizedHex)) return normalizedHex;
    return /^[A-Za-z0-9_-]{43}$/.test(value) || /^[A-Za-z0-9+/]{43}=$/.test(value)
      ? value
      : null;
  }
  const normalized = value.replace(/^0x/i, "").toLowerCase();
  return HEX_64_PATTERN.test(normalized) ? normalized : null;
}

async function verifySolanaTransfer(intent: FundingIntentRow, transactionId: string) {
  const connection = new Connection(getSolanaRpcUrl(), "finalized");
  let transaction = null;
  for (let attempt = 0; attempt < 5 && !transaction; attempt += 1) {
    transaction = await connection.getParsedTransaction(transactionId, {
      commitment: "finalized",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction && attempt < 4) await new Promise((resolve) => setTimeout(resolve, 600));
  }
  if (!transaction || transaction.meta?.err || !transaction.blockTime) return null;
  const instructions = transaction.transaction.message.instructions;
  if (!instructions.some((instruction) => readMemo(instruction) === `moneynerds:${intent.id}`)) {
    throw new Error("The finalized Solana transaction is missing this funding intent memo.");
  }

  let transferIndex = -1;
  if (intent.asset === "SOL") {
    transferIndex = instructions.findIndex((instruction) => {
      if (!isParsedInstruction(instruction) || instruction.program !== "system") return false;
      const parsed = instruction.parsed as {
        type?: string;
        info?: { source?: string; destination?: string; lamports?: number };
      };
      return parsed.type === "transfer" &&
        parsed.info?.source === intent.sender_address &&
        parsed.info?.destination === intent.recipient_address &&
        String(parsed.info?.lamports) === String(intent.amount_atomic);
    });
  } else {
    if (!intent.token_contract) throw new Error("The funding token contract is missing.");
    const mint = new PublicKey(intent.token_contract);
    const expectedDestination = getAssociatedTokenAddressSync(
      mint,
      new PublicKey(intent.recipient_address),
    ).toBase58();
    transferIndex = instructions.findIndex((instruction) => {
      if (!isParsedInstruction(instruction) || !instruction.program.startsWith("spl-token")) return false;
      const parsed = instruction.parsed as {
        type?: string;
        info?: {
          authority?: string;
          destination?: string;
          mint?: string;
          amount?: string;
          tokenAmount?: { amount?: string };
        };
      };
      const amount = parsed.info?.tokenAmount?.amount ?? parsed.info?.amount;
      return (parsed.type === "transferChecked" || parsed.type === "transfer") &&
        parsed.info?.authority === intent.sender_address &&
        parsed.info?.destination === expectedDestination &&
        (!parsed.info?.mint || parsed.info.mint === intent.token_contract) &&
        String(amount) === String(intent.amount_atomic);
    });
  }
  if (transferIndex < 0) {
    throw new Error("The finalized Solana transfer does not match this funding request.");
  }
  return {
    transactionHash: transactionId,
    transferIndex,
    blockHeight: transaction.slot,
    blockTime: new Date(transaction.blockTime * 1_000).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

async function ethereumRpc<T>(method: string, params: unknown[]) {
  const endpoint = process.env.ETHEREUM_RPC_URL ??
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ??
    "https://ethereum-rpc.publicnode.com";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Ethereum RPC is temporarily unavailable.");
  const payload = (await response.json()) as JsonRpcResponse<T>;
  if (payload.error) throw new Error("Ethereum RPC is temporarily unavailable.");
  return payload.result ?? null;
}

function decodeErc20Transfer(input: string) {
  const match = /^0xa9059cbb[0]{24}([0-9a-f]{40})([0-9a-f]{64})$/i.exec(input);
  if (!match) return null;
  return { recipient: `0x${match[1].toLowerCase()}`, amount: BigInt(`0x${match[2]}`).toString() };
}

async function verifyEthereumTransfer(intent: FundingIntentRow, transactionId: string) {
  interface EthereumTransaction {
    blockNumber?: string | null;
    from?: string;
    to?: string | null;
    value?: string;
    input?: string;
  }
  interface EthereumReceipt {
    blockNumber?: string;
    status?: string;
    transactionIndex?: string;
  }
  interface EthereumBlock { timestamp?: string }

  const [transaction, receipt, latestBlockHex] = await Promise.all([
    ethereumRpc<EthereumTransaction>("eth_getTransactionByHash", [transactionId]),
    ethereumRpc<EthereumReceipt>("eth_getTransactionReceipt", [transactionId]),
    ethereumRpc<string>("eth_blockNumber", []),
  ]);
  if (!transaction || !receipt || !transaction.blockNumber || receipt.status !== "0x1") return null;
  const blockNumber = Number.parseInt(receipt.blockNumber ?? transaction.blockNumber, 16);
  const latestBlock = latestBlockHex ? Number.parseInt(latestBlockHex, 16) : blockNumber;
  if (!Number.isSafeInteger(blockNumber) || latestBlock < blockNumber + 1) return null;
  const sender = normalizePayoutAddress("ETH", transaction.from ?? "");
  if (sender !== intent.sender_address) throw new Error("The Ethereum sender does not match the funding intent.");

  if (intent.asset === "ETH") {
    const recipient = normalizePayoutAddress("ETH", transaction.to ?? "");
    if (
      recipient !== intent.recipient_address ||
      BigInt(transaction.value ?? "0x0").toString() !== String(intent.amount_atomic)
    ) throw new Error("The Ethereum transfer does not match this funding request.");
    const expectedMemoHex = `0x${Array.from(
      new TextEncoder().encode(`moneynerds:${intent.id}`),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("")}`;
    const transactionInput = (transaction.input ?? "0x").toLowerCase();
    if (transactionInput !== "0x" && transactionInput !== expectedMemoHex) {
      throw new Error("The Ethereum transaction is missing this funding intent reference.");
    }
  } else {
    const contract = normalizePayoutAddress("ETH", transaction.to ?? "");
    const transfer = decodeErc20Transfer(transaction.input ?? "");
    if (
      contract !== intent.token_contract ||
      transfer?.recipient !== intent.recipient_address ||
      transfer.amount !== String(intent.amount_atomic)
    ) throw new Error("The token transfer does not match this funding request.");
  }

  const block = await ethereumRpc<EthereumBlock>("eth_getBlockByNumber", [receipt.blockNumber, false]);
  if (!block?.timestamp) throw new Error("Ethereum block time is temporarily unavailable.");
  return {
    transactionHash: transactionId,
    transferIndex: Number.parseInt(receipt.transactionIndex ?? "0x0", 16),
    blockHeight: blockNumber,
    blockTime: new Date(Number.parseInt(block.timestamp, 16) * 1_000).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The network indexer is temporarily unavailable.");
  return await response.json() as T;
}

async function verifyBitcoinTransfer(intent: FundingIntentRow, transactionId: string) {
  interface BitcoinTransaction {
    txid?: string;
    vin?: Array<{ prevout?: { scriptpubkey_address?: string } }>;
    vout?: Array<{ scriptpubkey_address?: string; value?: number }>;
    status?: { confirmed?: boolean; block_height?: number; block_time?: number };
  }
  const baseUrl = (process.env.BITCOIN_API_URL ?? "https://mempool.space/api").replace(/\/$/, "");
  const [transaction, tipText] = await Promise.all([
    fetchJson<BitcoinTransaction>(`${baseUrl}/tx/${transactionId}`),
    fetch(`${baseUrl}/blocks/tip/height`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).then((response) => response.ok ? response.text() : ""),
  ]);
  if (!transaction || !transaction.status?.confirmed) return null;
  const blockHeight = Number(transaction.status.block_height);
  const tipHeight = Number(tipText);
  if (
    !Number.isSafeInteger(blockHeight) ||
    !Number.isSafeInteger(tipHeight) ||
    tipHeight < blockHeight + 1 ||
    !Number.isSafeInteger(transaction.status.block_time)
  ) return null;
  if (transaction.txid?.toLowerCase() !== transactionId) {
    throw new Error("The Bitcoin indexer returned a different transaction.");
  }
  const hasSender = transaction.vin?.some((input) =>
    normalizePayoutAddress("BTC", input.prevout?.scriptpubkey_address ?? "") === intent.sender_address,
  );
  if (!hasSender) throw new Error("The Bitcoin inputs do not include the funding sender.");
  const transferIndex = transaction.vout?.findIndex((output) =>
    normalizePayoutAddress("BTC", output.scriptpubkey_address ?? "") === intent.recipient_address &&
    Number.isSafeInteger(output.value) &&
    String(output.value) === String(intent.amount_atomic),
  ) ?? -1;
  if (transferIndex < 0) throw new Error("The Bitcoin outputs do not match this funding request.");
  return {
    transactionHash: transactionId,
    transferIndex,
    blockHeight,
    blockTime: new Date(Number(transaction.status.block_time) * 1_000).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

function tronAddressHex(address: string) {
  try {
    return Buffer.from(bs58.decode(address).subarray(0, 21)).toString("hex").toLowerCase();
  } catch {
    return "";
  }
}

function exactJsonInteger(value: unknown) {
  if (typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

async function tronRpc<T>(path: string, transactionId: string) {
  const baseUrl = (process.env.TRON_RPC_URL ?? "https://api.trongrid.io").replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRON_PRO_API_KEY) headers["TRON-PRO-API-KEY"] = process.env.TRON_PRO_API_KEY;
  return fetchJson<T>(`${baseUrl}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ value: transactionId }),
  });
}

async function verifyTronTransfer(intent: FundingIntentRow, transactionId: string) {
  interface TronTransaction {
    txID?: string;
    ret?: Array<{ contractRet?: string }>;
    raw_data?: {
      timestamp?: number;
      contract?: Array<{
        parameter?: {
          type_url?: string;
          value?: {
            owner_address?: string;
            to_address?: string;
            amount?: number | string;
            contract_address?: string;
            data?: string;
          };
        };
      }>;
    };
  }
  interface TronReceipt {
    id?: string;
    blockNumber?: number;
    blockTimeStamp?: number;
    result?: string;
    receipt?: { result?: string };
  }
  const [transaction, receipt] = await Promise.all([
    tronRpc<TronTransaction>("walletsolidity/gettransactionbyid", transactionId),
    tronRpc<TronReceipt>("walletsolidity/gettransactioninfobyid", transactionId),
  ]);
  if (!transaction?.txID || !receipt?.id) return null;
  if (
    transaction.txID.toLowerCase() !== transactionId ||
    receipt.id.toLowerCase() !== transactionId ||
    transaction.ret?.[0]?.contractRet !== "SUCCESS" ||
    (receipt.receipt?.result && receipt.receipt.result !== "SUCCESS") ||
    (receipt.result && receipt.result !== "SUCCESS")
  ) throw new Error("The TRON transaction did not execute successfully.");
  const contract = transaction.raw_data?.contract?.[0];
  const value = contract?.parameter?.value;
  const senderHex = tronAddressHex(intent.sender_address);
  const recipientHex = tronAddressHex(intent.recipient_address);
  if (!senderHex || !recipientHex || value?.owner_address?.toLowerCase() !== senderHex) {
    throw new Error("The TRON sender does not match this funding request.");
  }

  if (intent.asset === "TRX") {
    if (
      !contract?.parameter?.type_url?.endsWith("TransferContract") ||
      value?.to_address?.toLowerCase() !== recipientHex ||
      exactJsonInteger(value?.amount) !== String(intent.amount_atomic)
    ) throw new Error("The TRX transfer does not match this funding request.");
  } else {
    const tokenHex = intent.token_contract ? tronAddressHex(intent.token_contract) : "";
    const transfer = /^a9059cbb[0]{24}([0-9a-f]{40})([0-9a-f]{64})$/i.exec(value?.data ?? "");
    if (
      !contract?.parameter?.type_url?.endsWith("TriggerSmartContract") ||
      value?.contract_address?.toLowerCase() !== tokenHex ||
      `41${transfer?.[1]?.toLowerCase() ?? ""}` !== recipientHex ||
      (transfer ? BigInt(`0x${transfer[2]}`).toString() : "") !== String(intent.amount_atomic)
    ) throw new Error("The TRC-20 transfer does not match this funding request.");
  }
  const blockHeight = Number(receipt.blockNumber);
  const blockTimeMs = Number(receipt.blockTimeStamp ?? transaction.raw_data?.timestamp);
  if (!Number.isSafeInteger(blockHeight) || !Number.isSafeInteger(blockTimeMs)) return null;
  return {
    transactionHash: transactionId,
    transferIndex: 0,
    blockHeight,
    blockTime: new Date(blockTimeMs).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

async function verifyTonTransfer(intent: FundingIntentRow, transactionId: string) {
  interface TonMessage {
    source?: string;
    destination?: string;
    value?: string;
    created_at?: string | number;
  }
  interface TonTransaction {
    hash?: string;
    now?: number;
    mc_block_seqno?: number;
    finality?: number;
    emulated?: boolean;
    description?: { aborted?: boolean; action?: { success?: boolean } };
    out_msgs?: TonMessage[];
  }
  interface TonResponse { transactions?: TonTransaction[] }
  const baseUrl = (process.env.TONCENTER_API_URL ?? "https://toncenter.com/api/v3").replace(/\/$/, "");
  const query = new URLSearchParams({ hash: transactionId, limit: "2" });
  const headers: Record<string, string> = {};
  if (process.env.TONCENTER_API_KEY) headers["X-API-Key"] = process.env.TONCENTER_API_KEY;
  const payload = await fetchJson<TonResponse>(`${baseUrl}/transactions?${query.toString()}`, { headers });
  const transaction = payload?.transactions?.[0];
  if (!transaction) return null;
  if (
    transaction.emulated ||
    transaction.description?.aborted ||
    transaction.description?.action?.success === false ||
    !Number.isSafeInteger(transaction.mc_block_seqno) ||
    Number(transaction.mc_block_seqno) <= 0
  ) throw new Error("The TON transaction is not finalized successfully.");
  const transferIndex = transaction.out_msgs?.findIndex((message) =>
    normalizePayoutAddress("TON", message.source ?? "") === intent.sender_address &&
    normalizePayoutAddress("TON", message.destination ?? "") === intent.recipient_address &&
    String(message.value) === String(intent.amount_atomic),
  ) ?? -1;
  if (transferIndex < 0) throw new Error("The TON messages do not match this funding request.");
  const message = transaction.out_msgs?.[transferIndex];
  const blockTime = Number(message?.created_at ?? transaction.now);
  if (!Number.isSafeInteger(blockTime)) return null;
  return {
    transactionHash: transactionId,
    transferIndex,
    blockHeight: Number(transaction.mc_block_seqno),
    blockTime: new Date(blockTime * 1_000).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

async function verifyInjectiveTransfer(intent: FundingIntentRow, transactionId: string) {
  interface InjectiveMessage {
    "@type"?: string;
    from_address?: string;
    to_address?: string;
    amount?: Array<{ denom?: string; amount?: string }>;
  }
  interface InjectiveResponse {
    tx?: { body?: { messages?: InjectiveMessage[] } };
    tx_response?: {
      code?: number;
      height?: string;
      timestamp?: string;
      txhash?: string;
    };
  }
  const baseUrl = (process.env.INJECTIVE_LCD_URL ?? "https://sentry.lcd.injective.network").replace(/\/$/, "");
  const payload = await fetchJson<InjectiveResponse>(
    `${baseUrl}/cosmos/tx/v1beta1/txs/${transactionId.toUpperCase()}`,
  );
  if (!payload?.tx_response) return null;
  if (
    Number(payload.tx_response.code ?? 0) !== 0 ||
    payload.tx_response.txhash?.toLowerCase() !== transactionId
  ) throw new Error("The Injective transaction did not execute successfully.");
  const messages = payload.tx?.body?.messages ?? [];
  const transferIndex = messages.findIndex((message) =>
    message["@type"] === "/cosmos.bank.v1beta1.MsgSend" &&
    normalizePayoutAddress("INJ", message.from_address ?? "") === intent.sender_address &&
    normalizePayoutAddress("INJ", message.to_address ?? "") === intent.recipient_address &&
    message.amount?.some((coin) =>
      coin.denom === "inj" && coin.amount === String(intent.amount_atomic),
    ),
  );
  if (transferIndex < 0) throw new Error("The Injective bank transfer does not match this funding request.");
  const blockHeight = Number(payload.tx_response.height);
  const blockTime = Date.parse(payload.tx_response.timestamp ?? "");
  if (!Number.isSafeInteger(blockHeight) || !Number.isFinite(blockTime)) return null;
  return {
    transactionHash: transactionId,
    transferIndex,
    blockHeight,
    blockTime: new Date(blockTime).toISOString(),
    senderAddress: intent.sender_address,
    recipientAddress: intent.recipient_address,
  } satisfies VerifiedTransfer;
}

async function verifyManualTransfer(intent: FundingIntentRow, transactionId: string) {
  switch (intent.asset) {
    case "BTC":
      return verifyBitcoinTransfer(intent, transactionId);
    case "TRX":
    case "USDT-TRC20":
      return verifyTronTransfer(intent, transactionId);
    case "TON":
      return verifyTonTransfer(intent, transactionId);
    case "INJ":
      return verifyInjectiveTransfer(intent, transactionId);
    default:
      return null;
  }
}

async function recordVerified(intent: FundingIntentRow, transfer: VerifiedTransfer) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("record_verified_funding_donation", {
    p_intent_id: intent.id,
    p_chain_namespace: intent.chain_namespace,
    p_network_reference: intent.network_reference,
    p_asset: intent.asset,
    p_amount_atomic: String(intent.amount_atomic),
    p_transaction_hash: transfer.transactionHash,
    p_transfer_index: transfer.transferIndex,
    p_sender_address: transfer.senderAddress,
    p_recipient_address: transfer.recipientAddress,
    p_block_height: transfer.blockHeight,
    p_block_time: transfer.blockTime,
  });
  if (error || !data) {
    console.error("Unable to record verified multichain funding", { code: error?.code });
    throw new Error("The transfer succeeded, but indexing is still pending. Retry verification—do not send again.");
  }
  return data as { verified?: boolean; transaction_hash?: string; already_recorded?: boolean };
}

async function submitManualPending(
  donorProfile: string,
  intent: FundingIntentRow,
  transactionId: string,
) {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("submit_funding_transaction", {
    p_intent_id: intent.id,
    p_donor_profile_wallet: donorProfile,
    p_transaction_hash: transactionId,
  });
  if (error) {
    // The pending-submission table/RPC can land independently of browser code.
    console.error("Unable to persist pending funding transaction", { code: error.code });
  }
  const submission = data as { status?: unknown; already_submitted?: unknown } | null;
  if (!error && submission?.status === "verified") {
    await revalidateFundingPaths(donorProfile, intent);
    return NextResponse.json({
      status: "verified",
      verified: true,
      transactionId,
      alreadyRecorded: submission.already_submitted === true,
    });
  }
  return NextResponse.json(
    {
      status: "pending",
      verified: false,
      transactionId,
      submissionRecorded: !error && Boolean(data),
      message: "Submitted for independent network verification; it is not included in verified totals yet.",
    },
    { status: 202 },
  );
}

async function revalidateFundingPaths(donorProfile: string, intent: FundingIntentRow) {
  revalidatePath("/");
  revalidatePath(`/u/${donorProfile}`);
  if (intent.recipient_profile_wallet) revalidatePath(`/u/${intent.recipient_profile_wallet}`);
  if (intent.target_type === "post" && intent.post_id) revalidatePath(`/p/${intent.post_id}`);
  if (intent.target_type === "comment" && intent.comment_id) {
    const { data: comment } = await createAdminSupabase()
      .from("comments")
      .select("post_id")
      .eq("id", intent.comment_id)
      .maybeSingle();
    if (comment?.post_id) revalidatePath(`/p/${comment.post_id}`);
  }
}

async function verifyLegacySolana(
  donorProfile: string,
  intentId: string,
  signature: string,
) {
  try {
    if (bs58.decode(signature).length !== 64) throw new Error("bad signature");
  } catch {
    return apiError("Invalid Solana transaction signature.");
  }
  const supabase = createAdminSupabase();
  const { data: intent } = await supabase
    .from("donation_intents")
    .select("id, donor_wallet, recipient_wallet, target_type, post_id, comment_id, lamports, used_signature")
    .eq("id", intentId)
    .eq("donor_wallet", donorProfile)
    .maybeSingle();
  if (!intent) return apiError("This funding request was not found. Start again from Fund.", 404);
  if (intent.used_signature) {
    return intent.used_signature === signature
      ? NextResponse.json({ verified: true, transactionId: signature, alreadyRecorded: true })
      : apiError("This funding request was already used.", 409);
  }
  const connection = new Connection(getSolanaRpcUrl(), "finalized");
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  if (!transaction || transaction.meta?.err || !transaction.blockTime) {
    return apiError("The transfer is not finalized on Solana yet. Retry in a moment.", 409);
  }
  const instructions = transaction.transaction.message.instructions;
  const transferIndex = instructions.findIndex((instruction) => {
    if (!isParsedInstruction(instruction) || instruction.program !== "system") return false;
    const parsed = instruction.parsed as {
      type?: string;
      info?: { source?: string; destination?: string; lamports?: number };
    };
    return parsed.type === "transfer" &&
      parsed.info?.source === intent.donor_wallet &&
      parsed.info?.destination === intent.recipient_wallet &&
      Number(parsed.info?.lamports) === Number(intent.lamports);
  });
  const hasMemo = instructions.some((instruction) => readMemo(instruction) === `moneynerds:${intent.id}`);
  if (transferIndex < 0 || !hasMemo) {
    return apiError("The finalized transfer does not match this Money Nerds funding request.", 422);
  }
  const { data, error } = await supabase.rpc("record_verified_donation", {
    p_intent_id: intent.id,
    p_signature: signature,
    p_instruction_index: transferIndex,
    p_slot: transaction.slot,
    p_transaction_created_at: new Date(transaction.blockTime * 1_000).toISOString(),
  });
  if (error || !data) {
    return apiError("The transfer succeeded, but indexing is pending. Retry—do not send again.", 409);
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  let donorProfile: string;
  try {
    donorProfile = (await requireWalletSession()).walletAddress;
  } catch {
    return unauthenticatedResponse();
  }

  let body: DonationBody;
  try {
    body = await readBoundedJsonBody<DonationBody>(request, 2_048);
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === "REQUEST_TOO_LARGE") {
      return apiError("The verification request is too large.", 413);
    }
    if (error instanceof RequestBodyError && error.code === "UNSUPPORTED_REQUEST_TYPE") {
      return apiError("Send verification details as JSON.", 415);
    }
    return apiError("The verification request could not be read.");
  }
  const intentId = typeof body.intentId === "string" ? body.intentId.trim() : "";
  const rawTransactionId = typeof body.transactionId === "string"
    ? body.transactionId
    : typeof body.signature === "string"
      ? body.signature
      : "";
  if (!UUID_PATTERN.test(intentId)) return apiError("Invalid funding intent.");

  const supabase = createAdminSupabase();
  const result = await supabase.rpc("get_funding_intent_for_verification", {
    p_intent_id: intentId,
    p_donor_profile_wallet: donorProfile,
  });

  if (result.error || !result.data) {
    return verifyLegacySolana(donorProfile, intentId, rawTransactionId.trim());
  }
  const intent = result.data as FundingIntentRow;
  if (!isPayoutAsset(intent.asset)) return apiError("That funding asset is no longer supported.", 409);
  const transactionId = normalizeTransactionId(intent.asset, rawTransactionId);
  if (!transactionId) return apiError(`Invalid ${PAYOUT_ASSET_CONFIG[intent.asset].networkName} transaction ID.`);
  if (intent.used_at) {
    if (intent.used_transaction_hash !== transactionId) {
      return apiError("This funding request was already used.", 409);
    }
    await revalidateFundingPaths(donorProfile, intent);
    return NextResponse.json({ verified: true, transactionId, alreadyRecorded: true });
  }

  const { data: allowed, error: rateError } = await supabase.rpc("consume_wallet_rate_limit", {
    p_wallet_address: donorProfile,
    p_action: "funding_verify",
    p_limit: 30,
    p_window_seconds: 60,
  });
  if (rateError || !allowed) {
    return apiError("Too many verification attempts. Wait a minute and retry.", 429);
  }

  if (PAYOUT_ASSET_CONFIG[intent.asset].walletMode === "manual") {
    try {
      const manualTransfer = await verifyManualTransfer(intent, transactionId);
      if (!manualTransfer) return submitManualPending(donorProfile, intent, transactionId);
      const recorded = await recordVerified(intent, manualTransfer);
      await revalidateFundingPaths(donorProfile, intent);
      return NextResponse.json({ ...recorded, transactionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network verification is temporarily unavailable.";
      if (message.includes("temporarily unavailable")) {
        return submitManualPending(donorProfile, intent, transactionId);
      }
      return apiError(message, 422);
    }
  }

  let verified: VerifiedTransfer | null;
  try {
    verified = intent.chain_namespace === "solana"
      ? await verifySolanaTransfer(intent, transactionId)
      : await verifyEthereumTransfer(intent, transactionId);
  } catch (error) {
    console.error("Unable to verify funding transaction", {
      asset: intent.asset,
      message: error instanceof Error ? error.message : "verification failed",
    });
    const message = error instanceof Error ? error.message : "Network verification is temporarily unavailable.";
    return apiError(message, message.includes("temporarily") ? 503 : 422);
  }
  if (!verified) {
    return apiError("The transaction is not sufficiently confirmed yet. Retry—do not send again.", 409);
  }

  try {
    const recorded = await recordVerified(intent, verified);
    await revalidateFundingPaths(donorProfile, intent);
    return NextResponse.json({ ...recorded, transactionId });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "The transfer is waiting to be indexed.",
      409,
      { transactionId },
    );
  }
}
