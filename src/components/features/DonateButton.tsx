"use client";

import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import { ArrowUpRight, Check, ExternalLink, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";

interface PendingDonation {
  intentId: string;
  signature: string;
  lamports: number;
  recipientWallet: string;
  createdAt: string;
}

type DonationStatus = "idle" | "sending" | "verifying" | "success" | "error";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const PENDING_STORAGE_EVENT = "moneynerds:pending-donation-change";

function parsePendingDonation(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PendingDonation>;
    if (
      typeof parsed.intentId === "string" &&
      typeof parsed.signature === "string" &&
      typeof parsed.lamports === "number" &&
      typeof parsed.recipientWallet === "string" &&
      typeof parsed.createdAt === "string"
    ) {
      return parsed as PendingDonation;
    }
  } catch {
    // Ignore corrupt local recovery data; the server still verifies every transfer.
  }
  return null;
}

export function DonateButton({
  recipientAddress,
  targetType,
  targetId,
  label = "Fund",
}: {
  recipientAddress: string;
  targetType: "post" | "comment" | "service";
  targetId?: number;
  label?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { connection } = useConnection();
  const wallet = useWallet();
  const { authenticated, session, invalidateSession } = useWalletSession();
  const router = useRouter();
  const [amount, setAmount] = useState("0.05");
  const [status, setStatus] = useState<DonationStatus>("idle");
  const [message, setMessage] = useState("");
  const [signatureState, setSignatureState] = useState({ key: "", value: "" });
  const [volatilePending, setVolatilePending] = useState<{
    key: string;
    value: PendingDonation | null;
  } | null>(null);
  const recipient = useMemo(() => {
    try {
      return new PublicKey(recipientAddress);
    } catch {
      return null;
    }
  }, [recipientAddress]);
  const walletAddress = wallet.publicKey?.toBase58() ?? session?.walletAddress ?? "";
  const pendingStorageKey = walletAddress
    ? `moneynerds:pending:${walletAddress}:${targetType}:${targetId ?? "service"}`
    : "";

  const subscribeToPending = useCallback((listener: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === pendingStorageKey) listener();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PENDING_STORAGE_EVENT, listener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PENDING_STORAGE_EVENT, listener);
    };
  }, [pendingStorageKey]);
  const readPendingSnapshot = useCallback(() => {
    if (!pendingStorageKey) return null;
    try {
      return window.localStorage.getItem(pendingStorageKey);
    } catch {
      return null;
    }
  }, [pendingStorageKey]);
  const storedPendingSnapshot = useSyncExternalStore(
    subscribeToPending,
    readPendingSnapshot,
    () => null,
  );
  const storedPending = useMemo(
    () => parsePendingDonation(storedPendingSnapshot),
    [storedPendingSnapshot],
  );
  const pending = volatilePending?.key === pendingStorageKey
    ? volatilePending.value
    : storedPending;
  const signature = signatureState.key === pendingStorageKey
    ? signatureState.value
    : pending?.signature ?? "";
  const effectiveAmount = pending
    ? String(pending.lamports / LAMPORTS_PER_SOL)
    : amount;
  const setSignature = (value: string) => {
    setSignatureState({ key: pendingStorageKey, value });
  };

  const persistPending = (value: PendingDonation | null) => {
    if (!pendingStorageKey) {
      setVolatilePending(null);
      return;
    }
    try {
      if (value) window.localStorage.setItem(pendingStorageKey, JSON.stringify(value));
      else window.localStorage.removeItem(pendingStorageKey);
      setVolatilePending(null);
      window.dispatchEvent(new Event(PENDING_STORAGE_EVENT));
    } catch {
      setVolatilePending({ key: pendingStorageKey, value });
    }
  };

  const open = () => {
    if (pending) {
      setStatus("error");
      setMessage(
        "This transfer was already submitted. Retry verification below—Money Nerds will not send it twice.",
      );
    } else {
      setStatus("idle");
      setMessage("");
      setSignature("");
    }
    dialogRef.current?.showModal();
  };

  const verify = async (value: PendingDonation) => {
    setStatus("verifying");
    setMessage("Checking finality and matching the Money Nerds donation intent.");
    try {
      const recordResponse = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: value.signature, intentId: value.intentId }),
      });
      const record = (await recordResponse.json()) as { error?: string };
      if (!recordResponse.ok) {
        if (recordResponse.status === 401) invalidateSession();
        throw new Error(record.error ?? "The transfer is still waiting for verification.");
      }
      setSignature(value.signature);
      persistPending(null);
      setStatus("success");
      setMessage(
        `${value.lamports / LAMPORTS_PER_SOL} SOL went directly to ${formatWallet(value.recipientWallet)}.`,
      );
      router.refresh();
    } catch (caught) {
      setStatus("error");
      setMessage(
        `${caught instanceof Error ? caught.message : "The transfer is still waiting for verification."} Do not send again; use Retry verification.`,
      );
    }
  };

  const donate = async () => {
    if (pending) {
      await verify(pending);
      return;
    }

    const value = Number(amount);
    const lamports = Math.round(value * LAMPORTS_PER_SOL);
    if (!authenticated || !wallet.publicKey || !recipient) {
      setStatus("error");
      setMessage("Connect and sign your wallet first.");
      return;
    }
    if (wallet.publicKey.equals(recipient)) {
      setStatus("error");
      setMessage("A wallet cannot fund itself.");
      return;
    }
    if (!Number.isFinite(value) || !Number.isSafeInteger(lamports) || lamports <= 0) {
      setStatus("error");
      setMessage("Enter a valid SOL amount.");
      return;
    }

    setStatus("sending");
    setMessage("Preparing a single-use donation request.");
    let submitted: PendingDonation | null = null;
    try {
      const intentResponse = await fetch("/api/donations/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId: targetId ?? null,
          lamports,
        }),
      });
      const intent = (await intentResponse.json()) as {
        id?: string;
        recipientWallet?: string;
        lamports?: number;
        error?: string;
      };
      if (!intentResponse.ok || !intent.id || !intent.recipientWallet) {
        if (intentResponse.status === 401) invalidateSession();
        throw new Error(intent.error ?? "The donation could not be prepared.");
      }
      if (intent.recipientWallet !== recipientAddress || Number(intent.lamports) !== lamports) {
        throw new Error("The recipient or amount changed. Close this dialog and try again.");
      }

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("finalized");
      const transaction = new Transaction({
        feePayer: wallet.publicKey,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(intent.recipientWallet),
          lamports,
        }),
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from(`moneynerds:${intent.id}`, "utf8"),
        }),
      );

      setMessage("Approve the direct transfer in your wallet. Money Nerds takes no fee.");
      const nextSignature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      submitted = {
        intentId: intent.id,
        signature: nextSignature,
        lamports,
        recipientWallet: intent.recipientWallet,
        createdAt: new Date().toISOString(),
      };
      setSignature(nextSignature);
      persistPending(submitted);
      setMessage("Transfer submitted. Waiting for finalized Solana confirmation.");

      const confirmation = await connection.confirmTransaction(
        { signature: nextSignature, blockhash, lastValidBlockHeight },
        "finalized",
      );
      if (confirmation.value.err) {
        persistPending(null);
        setSignature("");
        submitted = null;
        throw new Error("Solana reported that the transfer failed. No donation was recorded; you can try again.");
      }
      await verify(submitted);
    } catch (caught) {
      setStatus("error");
      const text = caught instanceof Error ? caught.message : "The transfer could not be completed.";
      if (submitted) {
        setMessage(
          `${text} The signature is saved; retry verification and do not send another transfer.`,
        );
      } else {
        setMessage(text.includes("User rejected") ? "You cancelled the transfer." : text);
      }
    }
  };

  const busy = status === "sending" || status === "verifying";
  return (
    <>
      <button className="post-action fund" type="button" onClick={open} disabled={!recipient}>
        <ArrowUpRight aria-hidden="true" size={18} />
        {pending ? "Verify transfer" : label}
      </button>
      <dialog ref={dialogRef} className="donation-dialog">
        <div className="donation-dialog-inner">
          <button
            className="donation-close"
            type="button"
            aria-label="Close donation dialog"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" size={19} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">
            Direct on Solana
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2efe6]">
            Send support. We take nothing.
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Your wallet transfers SOL straight to{" "}
            <span className="font-mono text-white/75">
              {formatWallet(recipientAddress, 6, 6)}
            </span>
            . Only the network fee applies.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["0.01", "0.05", "0.1", "0.5"].map((preset) => (
              <button
                key={preset}
                className={`amount-chip ${effectiveAmount === preset ? "active" : ""}`}
                type="button"
                onClick={() => setAmount(preset)}
                disabled={Boolean(pending)}
              >
                {preset} SOL
              </button>
            ))}
          </div>
          <label className="mt-4 grid gap-2 text-xs font-medium uppercase tracking-[0.13em] text-white/50">
            Custom amount in SOL
            <input
              className="min-h-12 rounded-xl border border-white/12 bg-black/25 px-4 text-lg normal-case tracking-normal text-[#f2efe6] outline-none focus:border-[#c9ff55]/70"
              type="number"
              min="0.000001"
              step="0.001"
              inputMode="decimal"
              value={effectiveAmount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={Boolean(pending)}
            />
          </label>
          <button
            className="button button-accent mt-5 w-full justify-center"
            type="button"
            onClick={() => void donate()}
            disabled={busy}
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
            {status === "sending"
              ? "Approve in wallet"
              : status === "verifying"
                ? "Verifying finality"
                : status === "success"
                  ? "Support verified"
                  : pending
                    ? "Retry verification"
                    : `Send ${effectiveAmount || "0"} SOL`}
          </button>
          <div
            className={`mt-3 min-h-10 text-sm leading-5 ${status === "error" ? "text-[#ff8066]" : "text-white/55"}`}
            role="status"
            aria-live="polite"
          >
            {message}
            {signature ? (
              <a
                className="mt-1 flex items-center gap-1 text-[#9ccaff] hover:underline"
                href={`https://solscan.io/tx/${signature}`}
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
