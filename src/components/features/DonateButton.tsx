"use client";

import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  WalletCards,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";
import {
  atomicAmountToDecimal,
  buildPaymentUri,
  decimalAmountToAtomic,
  isPayoutAsset,
  normalizePayoutAddress,
  PAYOUT_ASSET_CONFIG,
  transactionExplorerUrl,
  type FundingOption,
  type PayoutAsset,
} from "@/lib/funding/payouts";

type TargetType = "post" | "comment" | "service";
type DonationStatus =
  | "idle"
  | "loading"
  | "sending"
  | "verifying"
  | "pending"
  | "success"
  | "error";

interface PendingDonation {
  intentId: string;
  transactionId: string;
  asset: PayoutAsset;
  atomicAmount: string;
  recipientAddress: string;
  createdAt: string;
}

interface DonationIntent {
  id: string;
  asset: PayoutAsset;
  recipientAddress: string;
  atomicAmount: string;
  expiresAt: string;
  paymentUri: string;
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const DEFAULT_AMOUNTS: Record<PayoutAsset, string> = {
  SOL: "0.05",
  "USDC-SOL": "5",
  "USDT-SOL": "5",
  ETH: "0.005",
  "USDT-ERC20": "5",
  BTC: "0.0001",
  TRX: "25",
  "USDT-TRC20": "5",
  TON: "1",
  INJ: "1",
};

function readPending(value: string | null): PendingDonation | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingDonation>;
    if (
      typeof parsed.intentId === "string" &&
      typeof parsed.transactionId === "string" &&
      typeof parsed.asset === "string" &&
      isPayoutAsset(parsed.asset) &&
      typeof parsed.atomicAmount === "string" &&
      typeof parsed.recipientAddress === "string" &&
      typeof parsed.createdAt === "string"
    ) {
      return parsed as PendingDonation;
    }
  } catch {
    // Corrupt local recovery data is ignored; the server remains authoritative.
  }
  return null;
}

function getEthereumProvider() {
  return (window as typeof window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

function encodeUtf8Hex(value: string) {
  return `0x${Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function erc20TransferData(recipient: string, atomicAmount: string) {
  return `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64, "0")}${BigInt(
    atomicAmount,
  )
    .toString(16)
    .padStart(64, "0")}`;
}

export function DonateButton({
  recipientAddress,
  targetType,
  targetId,
  label = "Fund",
}: {
  /** Legacy SOL hint. The server always resolves the authoritative destination. */
  recipientAddress?: string;
  targetType: TargetType;
  targetId?: number;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { connection } = useConnection();
  const solanaWallet = useWallet();
  const { setVisible: setSolanaWalletVisible } = useWalletModal();
  const { authenticated, session, invalidateSession } = useWalletSession();
  const router = useRouter();
  const [options, setOptions] = useState<FundingOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<PayoutAsset>("SOL");
  const [amount, setAmount] = useState(DEFAULT_AMOUNTS.SOL);
  const [status, setStatus] = useState<DonationStatus>("idle");
  const [message, setMessage] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [manualSenderAddress, setManualSenderAddress] = useState("");
  const [manualIntent, setManualIntent] = useState<DonationIntent | null>(null);
  const [manualWalletFallback, setManualWalletFallback] = useState(false);
  const [pending, setPending] = useState<PendingDonation | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.asset === selectedAsset) ?? null,
    [options, selectedAsset],
  );
  const config = PAYOUT_ASSET_CONFIG[selectedAsset];
  const pendingStorageKey = session?.walletAddress
    ? `moneynerds:pending:${session.walletAddress}:${targetType}:${targetId ?? "service"}`
    : "";

  const persistPending = useCallback(
    (value: PendingDonation | null) => {
      setPending(value);
      if (!pendingStorageKey) return;
      try {
        if (value) window.localStorage.setItem(pendingStorageKey, JSON.stringify(value));
        else window.localStorage.removeItem(pendingStorageKey);
      } catch {
        // Recovery is best effort. The chain and server intent remain authoritative.
      }
    },
    [pendingStorageKey],
  );

  const loadOptions = useCallback(async (savedPending: PendingDonation | null) => {
    setStatus("loading");
    setMessage("Loading this request's direct payment routes…");
    try {
      const query = new URLSearchParams({ targetType });
      if (targetId) query.set("targetId", String(targetId));
      const response = await fetch(`/api/funding/options?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        options?: Array<{
          id?: unknown;
          asset?: unknown;
          address?: unknown;
          verificationStatus?: unknown;
        }>;
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Funding routes are unavailable.");

      const resolved = (payload.options ?? []).flatMap((option) => {
        const asset = typeof option.asset === "string" ? option.asset : "";
        const address = typeof option.address === "string" ? option.address : "";
        if (!isPayoutAsset(asset) || normalizePayoutAddress(asset, address) !== address) return [];
        return [{
          id: typeof option.id === "string" ? option.id : `${asset}:${address}`,
          asset,
          address,
          config: PAYOUT_ASSET_CONFIG[asset],
          verificationStatus:
            option.verificationStatus === "verified" ? "verified" as const : "self_declared" as const,
        }];
      });
      if (
        savedPending &&
        !resolved.some((option) => option.asset === savedPending.asset) &&
        normalizePayoutAddress(savedPending.asset, savedPending.recipientAddress) === savedPending.recipientAddress
      ) {
        resolved.push({
          id: `recovery:${savedPending.intentId}`,
          asset: savedPending.asset,
          address: savedPending.recipientAddress,
          config: PAYOUT_ASSET_CONFIG[savedPending.asset],
          verificationStatus: "self_declared",
        });
      }
      if (!resolved.length) throw new Error("This request has no active funding routes yet.");
      setOptions(resolved);
      const nextAsset = savedPending
        ? savedPending.asset
        : resolved.some((option) => option.asset === selectedAsset)
          ? selectedAsset
          : resolved[0].asset;
      setSelectedAsset(nextAsset);
      setAmount(DEFAULT_AMOUNTS[nextAsset]);
      setStatus(savedPending ? "pending" : "idle");
      setMessage(
        savedPending
          ? "A previous transaction is saved. Verify it before creating another payment."
          : "Choose the asset and network you want to use.",
      );
    } catch (error) {
      if (
        savedPending &&
        normalizePayoutAddress(savedPending.asset, savedPending.recipientAddress) === savedPending.recipientAddress
      ) {
        setOptions([{
          id: `recovery:${savedPending.intentId}`,
          asset: savedPending.asset,
          address: savedPending.recipientAddress,
          config: PAYOUT_ASSET_CONFIG[savedPending.asset],
          verificationStatus: "self_declared",
        }]);
        setSelectedAsset(savedPending.asset);
        setAmount(atomicAmountToDecimal(savedPending.asset, savedPending.atomicAmount));
        setStatus("pending");
        setMessage("A previous payment is saved. Retry its verification; do not send again.");
        return;
      }
      // This keeps the current SOL-only production schema fundable during rollout.
      const legacyAddress = recipientAddress
        ? normalizePayoutAddress("SOL", recipientAddress)
        : null;
      if (legacyAddress) {
        setOptions([{
          id: `legacy-sol:${legacyAddress}`,
          asset: "SOL",
          address: legacyAddress,
          config: PAYOUT_ASSET_CONFIG.SOL,
          verificationStatus: "verified",
        }]);
        setSelectedAsset("SOL");
        setAmount(DEFAULT_AMOUNTS.SOL);
        setStatus(savedPending ? "pending" : "idle");
        setMessage(savedPending ? "A previous SOL transfer is waiting for verification." : "Direct SOL route loaded.");
        return;
      }
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Funding routes are unavailable.");
    }
  }, [recipientAddress, selectedAsset, targetId, targetType]);

  const open = () => {
    let recovered = pending;
    try {
      recovered = pendingStorageKey
        ? readPending(window.localStorage.getItem(pendingStorageKey))
        : null;
    } catch {
      recovered = null;
    }
    setPending(recovered);
    setManualIntent(null);
    setTransactionId(recovered?.transactionId ?? "");
    dialogRef.current?.showModal();
    void loadOptions(recovered);
  };

  const prepareIntent = async (senderAddress?: string) => {
    if (!authenticated) throw new Error("Sign in before funding a request.");
    if (!selectedOption) throw new Error("Choose an available funding route.");
    const atomicAmount = decimalAmountToAtomic(selectedAsset, amount);
    if (!atomicAmount) {
      throw new Error(`Enter a valid ${config.symbol} amount with at most ${config.decimals} decimals.`);
    }

    const response = await fetch("/api/donations/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId: targetId ?? null,
        asset: selectedAsset,
        atomicAmount: atomicAmount.toString(),
        senderAddress: senderAddress ?? null,
      }),
    });
    const payload = (await response.json()) as Partial<DonationIntent> & { error?: string };
    if (!response.ok) {
      if (response.status === 401) invalidateSession();
      throw new Error(payload.error ?? "The direct payment could not be prepared.");
    }
    if (
      !payload.id ||
      payload.asset !== selectedAsset ||
      payload.atomicAmount !== atomicAmount.toString() ||
      typeof payload.recipientAddress !== "string" ||
      normalizePayoutAddress(selectedAsset, payload.recipientAddress) !== payload.recipientAddress ||
      typeof payload.expiresAt !== "string"
    ) {
      throw new Error("The server returned an invalid payment request. Nothing was sent.");
    }
    if (payload.recipientAddress !== selectedOption.address) {
      throw new Error("The funding destination changed. Close this dialog and try again.");
    }
    return {
      id: payload.id,
      asset: payload.asset,
      recipientAddress: payload.recipientAddress,
      atomicAmount: payload.atomicAmount,
      expiresAt: payload.expiresAt,
      paymentUri:
        payload.paymentUri ??
        buildPaymentUri(
          payload.asset,
          payload.recipientAddress,
          payload.atomicAmount,
          payload.id,
        ),
    } satisfies DonationIntent;
  };

  const verify = async (value: PendingDonation) => {
    setStatus("verifying");
    setMessage(`Checking the ${PAYOUT_ASSET_CONFIG[value.asset].networkName} transaction…`);
    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: value.intentId, transactionId: value.transactionId }),
      });
      const payload = (await response.json()) as { error?: string; status?: string; verified?: boolean };
      if (response.status === 202 || payload.status === "pending") {
        setStatus("pending");
        setMessage(
          "Transaction submitted for indexing. It is not counted as verified until the network check completes.",
        );
        return;
      }
      if (!response.ok || !payload.verified) {
        if (response.status === 401) invalidateSession();
        throw new Error(payload.error ?? "The transaction is not verified yet.");
      }
      persistPending(null);
      setManualIntent(null);
      setStatus("success");
      setMessage(
        `${atomicAmountToDecimal(value.asset, value.atomicAmount)} ${PAYOUT_ASSET_CONFIG[value.asset].symbol} went directly to the recipient. Money Nerds took 0%.`,
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        `${error instanceof Error ? error.message : "Verification is temporarily unavailable."} Do not send another payment; retry verification.`,
      );
    }
  };

  const sendSolana = async () => {
    if (!solanaWallet.publicKey) {
      setStatus("idle");
      setMessage("Choose the Solana wallet that will send this payment, then open Fund again.");
      dialogRef.current?.close();
      setSolanaWalletVisible(true);
      return;
    }
    if (!solanaWallet.connected) await solanaWallet.connect();
    const sender = solanaWallet.publicKey.toBase58();
    const intent = await prepareIntent(sender);
    const recipient = new PublicKey(intent.recipientAddress);
    if (solanaWallet.publicKey.equals(recipient)) throw new Error("A wallet cannot fund itself.");
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
    const transaction = new Transaction({
      feePayer: solanaWallet.publicKey,
      recentBlockhash: blockhash,
    });
    const atomicAmount = BigInt(intent.atomicAmount);

    if (selectedAsset === "SOL") {
      if (atomicAmount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("That SOL amount is too large.");
      transaction.add(SystemProgram.transfer({
        fromPubkey: solanaWallet.publicKey,
        toPubkey: recipient,
        lamports: Number(atomicAmount),
      }));
    } else {
      const mintAddress = PAYOUT_ASSET_CONFIG[selectedAsset].contractAddress;
      if (!mintAddress) throw new Error("This token route is not configured.");
      const mint = new PublicKey(mintAddress);
      const sourceAccount = getAssociatedTokenAddressSync(mint, solanaWallet.publicKey);
      const recipientAccount = getAssociatedTokenAddressSync(mint, recipient);
      if (!(await connection.getAccountInfo(recipientAccount, "confirmed"))) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            solanaWallet.publicKey,
            recipientAccount,
            recipient,
            mint,
          ),
        );
      }
      transaction.add(
        createTransferCheckedInstruction(
          sourceAccount,
          mint,
          recipientAccount,
          solanaWallet.publicKey,
          atomicAmount,
          PAYOUT_ASSET_CONFIG[selectedAsset].decimals,
        ),
      );
    }
    transaction.add(new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(`moneynerds:${intent.id}`, "utf8"),
    }));

    setMessage("Approve the direct transaction in your wallet. Only network fees apply.");
    const signature = await solanaWallet.sendTransaction(transaction, connection, {
      skipPreflight: false,
      maxRetries: 3,
    });
    const saved: PendingDonation = {
      intentId: intent.id,
      transactionId: signature,
      asset: intent.asset,
      atomicAmount: intent.atomicAmount,
      recipientAddress: intent.recipientAddress,
      createdAt: new Date().toISOString(),
    };
    setTransactionId(signature);
    persistPending(saved);
    setMessage("Transaction submitted. Waiting for finalized Solana confirmation…");
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "finalized",
    );
    if (confirmation.value.err) {
      persistPending(null);
      throw new Error("Solana reported that the transaction failed. You can try again.");
    }
    await verify(saved);
  };

  const sendEvm = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setManualWalletFallback(true);
      setStatus("idle");
      setMessage("No injected Ethereum wallet was detected. Enter your sending address to use a QR or wallet link instead.");
      return;
    }
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const sender = normalizePayoutAddress("ETH", accounts?.[0] ?? "");
    if (!sender) throw new Error("The EVM wallet returned an invalid account.");
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x1" }] });
    const intent = await prepareIntent(sender);
    if (sender === intent.recipientAddress) throw new Error("A wallet cannot fund itself.");
    const tokenContract = PAYOUT_ASSET_CONFIG[selectedAsset].contractAddress;
    const params = selectedAsset === "ETH"
      ? {
          from: sender,
          to: intent.recipientAddress,
          value: `0x${BigInt(intent.atomicAmount).toString(16)}`,
          data: encodeUtf8Hex(`moneynerds:${intent.id}`),
        }
      : {
          from: sender,
          to: tokenContract,
          value: "0x0",
          data: erc20TransferData(intent.recipientAddress, intent.atomicAmount),
        };
    setMessage("Approve the direct Ethereum transaction. Money Nerds receives none of it.");
    const hash = await provider.request({ method: "eth_sendTransaction", params: [params] });
    if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) {
      throw new Error("The EVM wallet did not return a transaction hash.");
    }
    const saved: PendingDonation = {
      intentId: intent.id,
      transactionId: hash.toLowerCase(),
      asset: intent.asset,
      atomicAmount: intent.atomicAmount,
      recipientAddress: intent.recipientAddress,
      createdAt: new Date().toISOString(),
    };
    setTransactionId(saved.transactionId);
    persistPending(saved);
    setStatus("verifying");
    setMessage("Ethereum transaction submitted. Waiting for a confirmed receipt…");
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [saved.transactionId],
      });
      if (receipt) {
        await verify(saved);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_500));
    }
    setStatus("pending");
    setMessage("The transaction is still pending. Its hash is saved; retry verification later.");
  };

  const beginManual = async () => {
    const sender = normalizePayoutAddress(selectedAsset, manualSenderAddress);
    if (!sender) {
      throw new Error(`Enter the ${config.networkName} address that will send this payment.`);
    }
    const intent = await prepareIntent(sender);
    setManualIntent(intent);
    setStatus("pending");
    setMessage(
      `Scan or open the payment request, then paste the ${config.networkName} transaction ID. It will remain pending until independently verified.`,
    );
  };

  const submitManualTransaction = async () => {
    if (!manualIntent) return;
    const nextTransactionId = transactionId.trim();
    if (!nextTransactionId) {
      setStatus("error");
      setMessage("Paste the transaction ID from your wallet first.");
      return;
    }
    const saved: PendingDonation = {
      intentId: manualIntent.id,
      transactionId: nextTransactionId,
      asset: manualIntent.asset,
      atomicAmount: manualIntent.atomicAmount,
      recipientAddress: manualIntent.recipientAddress,
      createdAt: new Date().toISOString(),
    };
    persistPending(saved);
    await verify(saved);
  };

  const donate = async () => {
    if (pending) {
      await verify(pending);
      return;
    }
    if (!authenticated) {
      setStatus("error");
      setMessage("Sign in to Money Nerds before funding a request.");
      return;
    }
    setStatus("sending");
    setMessage("Preparing a single-use direct payment request…");
    try {
      if (config.walletMode === "solana") await sendSolana();
      else if (config.walletMode === "evm" && !manualWalletFallback) await sendEvm();
      else await beginManual();
    } catch (error) {
      setStatus("error");
      const text = error instanceof Error ? error.message : "The payment could not be prepared.";
      setMessage(/user rejected|user denied/i.test(text) ? "You cancelled the wallet request." : text);
    }
  };

  const busy = status === "loading" || status === "sending" || status === "verifying";
  const displayAmount = pending && pending.asset === selectedAsset
    ? atomicAmountToDecimal(pending.asset, pending.atomicAmount)
    : amount;
  const activeTransactionId = pending?.transactionId || transactionId;
  const activeExplorerUrl = activeTransactionId
    ? transactionExplorerUrl(pending?.asset ?? selectedAsset, activeTransactionId)
    : "";

  return (
    <>
      <button className="post-action fund" type="button" onClick={open}>
        <ArrowUpRight aria-hidden="true" size={18} />
        {pending ? "Verify payment" : label}
      </button>
      <dialog
        ref={dialogRef}
        className="donation-dialog"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="donation-dialog-inner max-h-[min(90dvh,760px)] overflow-y-auto">
          <button
            className="donation-close"
            type="button"
            aria-label="Close donation dialog"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" size={19} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
            Direct · zero platform fee
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2efe6]">
            Choose how to fund this request
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Money moves from your wallet to the recipient. Money Nerds never holds funds and takes 0%; only network fees apply.
          </p>

          {options.length ? (
            <fieldset className="mt-5">
              <legend className="text-xs font-medium uppercase tracking-[0.13em] text-white/50">
                Asset and network
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {options.map((option) => (
                  <button
                    key={option.id}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      selectedAsset === option.asset
                        ? "border-[#c9ff55]/70 bg-[#c9ff55]/10 text-[#f2efe6]"
                        : "border-white/10 bg-black/20 text-white/55 hover:border-white/25"
                    }`}
                    type="button"
                    disabled={Boolean(pending) || busy}
                    onClick={() => {
                      setSelectedAsset(option.asset);
                      setAmount(DEFAULT_AMOUNTS[option.asset]);
                      setManualIntent(null);
                      setTransactionId("");
                      setManualSenderAddress("");
                      setManualWalletFallback(false);
                    }}
                  >
                    <span className="block text-sm font-semibold">{option.config.symbol}</span>
                    <span className="block truncate text-[0.65rem] opacity-65">{option.config.networkName}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {selectedOption ? (
            <>
              <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/50">
                Amount in {config.symbol}
                <input
                  className="min-h-12 rounded-xl border border-white/12 bg-black/25 px-4 text-lg normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={96}
                  value={displayAmount}
                  onChange={(event) => setAmount(event.target.value.replace(",", "."))}
                  disabled={Boolean(pending) || Boolean(manualIntent)}
                />
              </label>
              <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/45">
                To <span className="font-mono text-white/70">{formatWallet(selectedOption.address, 8, 8)}</span>
                {selectedOption.verificationStatus === "self_declared" ? (
                  <span className="mt-1 block text-[#ffd36a]">Recipient-declared route; check the address before approving.</span>
                ) : (
                  <span className="mt-1 block text-[#c9ff55]/75">Route ownership verified.</span>
                )}
              </div>
              {(config.walletMode === "manual" || manualWalletFallback) && !manualIntent ? (
                <label className="mt-3 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/50">
                  Your sending address on {config.networkName}
                  <input
                    className="min-h-11 rounded-xl border border-white/12 bg-black/25 px-3 font-mono text-xs normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={128}
                    value={manualSenderAddress}
                    onChange={(event) => setManualSenderAddress(event.target.value.trim())}
                    placeholder="Used to match the on-chain transfer"
                  />
                </label>
              ) : null}
            </>
          ) : null}

          {manualIntent ? (
            <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[152px_1fr]">
              <div className="mx-auto rounded-xl bg-white p-2">
                <QRCodeSVG value={manualIntent.paymentUri} size={136} level="M" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/80">
                  {atomicAmountToDecimal(manualIntent.asset, manualIntent.atomicAmount)} {config.symbol} on {config.networkName}
                </p>
                <p className="mt-2 break-all font-mono text-xs leading-5 text-white/55">
                  {manualIntent.recipientAddress}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="button button-secondary min-h-10 px-3 text-xs"
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(manualIntent.recipientAddress)}
                  >
                    <Copy aria-hidden="true" size={14} /> Copy address
                  </button>
                  <a className="button button-secondary min-h-10 px-3 text-xs" href={manualIntent.paymentUri}>
                    <WalletCards aria-hidden="true" size={14} /> Open wallet
                  </a>
                </div>
                <label className="mt-3 grid gap-1.5 text-xs text-white/50">
                  Transaction ID after sending
                  <input
                    className="min-h-10 rounded-lg border border-white/12 bg-black/25 px-3 font-mono text-xs text-white outline-none focus:border-[#c9ff55]/60"
                    value={transactionId}
                    maxLength={128}
                    onChange={(event) => setTransactionId(event.target.value)}
                    placeholder="Paste transaction ID"
                  />
                </label>
                <button
                  className="button button-accent mt-3 w-full justify-center"
                  type="button"
                  onClick={() => void submitManualTransaction()}
                  disabled={status === "verifying"}
                >
                  Submit for verification
                </button>
              </div>
            </div>
          ) : (
            <button
              className="button button-accent mt-5 w-full justify-center"
              type="button"
              onClick={() => void donate()}
              disabled={busy || !selectedOption || status === "success"}
            >
              {busy ? (
                <LoaderCircle className="spin" aria-hidden="true" size={18} />
              ) : status === "success" ? (
                <Check aria-hidden="true" size={18} />
              ) : pending ? (
                <RotateCcw aria-hidden="true" size={18} />
              ) : (
                <ArrowUpRight aria-hidden="true" size={18} />
              )}
              {status === "loading"
                ? "Loading routes"
                : status === "sending"
                  ? "Open wallet"
                  : status === "verifying"
                    ? "Checking network"
                    : status === "success"
                      ? "Payment verified"
                    : pending
                      ? "Retry verification"
                      : `Continue with ${config.symbol}`}
            </button>
          )}

          <div
            className={`mt-3 min-h-10 text-sm leading-5 ${status === "error" ? "text-[#ff8066]" : "text-white/55"}`}
            role="status"
            aria-live="polite"
          >
            {message}
            {activeExplorerUrl ? (
              <a
                className="mt-1 flex items-center gap-1 text-[#9ccaff] hover:underline"
                href={activeExplorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                View transaction <ExternalLink aria-hidden="true" size={13} />
              </a>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
