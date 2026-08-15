"use client";

import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ArrowUpRight, Check, ExternalLink, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { formatWallet } from "@/lib/format";

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
  const { authenticated } = useWalletSession();
  const router = useRouter();
  const [amount, setAmount] = useState("0.05");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const recipient = useMemo(() => {
    try {
      return new PublicKey(recipientAddress);
    } catch {
      return null;
    }
  }, [recipientAddress]);

  const open = () => {
    setStatus("idle");
    setMessage("");
    dialogRef.current?.showModal();
  };

  const donate = async () => {
    const value = Number(amount);
    const lamports = Math.round(value * LAMPORTS_PER_SOL);
    if (!authenticated || !wallet.publicKey || !recipient) {
      setStatus("error");
      setMessage("Connect and sign your wallet first.");
      return;
    }
    if (!Number.isFinite(value) || !Number.isSafeInteger(lamports) || lamports <= 0) {
      setStatus("error");
      setMessage("Enter a valid SOL amount.");
      return;
    }

    setStatus("sending");
    setMessage("Approve the direct transfer in your wallet.");
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: wallet.publicKey,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: recipient,
          lamports,
        }),
      );
      const nextSignature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: false,
        maxRetries: 3,
      });
      setSignature(nextSignature);
      const confirmation = await connection.confirmTransaction(
        { signature: nextSignature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (confirmation.value.err) throw new Error("Solana reported that the transfer failed.");

      const recordResponse = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: nextSignature,
          targetType,
          targetId: targetId ?? null,
          lamports,
        }),
      });
      const record = (await recordResponse.json()) as { error?: string };
      if (!recordResponse.ok) {
        throw new Error(record.error ?? "Transfer sent, but the public record is pending.");
      }
      setStatus("success");
      setMessage(`${value} SOL went directly to ${formatWallet(recipientAddress)}.`);
      router.refresh();
    } catch (caught) {
      setStatus("error");
      const text = caught instanceof Error ? caught.message : "The transfer could not be completed.";
      setMessage(text.includes("User rejected") ? "You cancelled the transfer." : text);
    }
  };

  return (
    <>
      <button className="post-action fund" type="button" onClick={open} disabled={!recipient}>
        <ArrowUpRight aria-hidden="true" size={18} />
        {label}
      </button>
      <dialog ref={dialogRef} className="donation-dialog" onCancel={() => setStatus("idle")}>
        <div className="donation-dialog-inner">
          <button
            className="donation-close"
            type="button"
            aria-label="Close donation dialog"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" size={19} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c9ff55]">Direct on Solana</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2efe6]">Send support. We take nothing.</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Your wallet transfers SOL straight to <span className="font-mono text-white/75">{formatWallet(recipientAddress, 6, 6)}</span>. Only the network fee applies.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["0.01", "0.05", "0.1", "0.5"].map((value) => (
              <button
                key={value}
                className={`amount-chip ${amount === value ? "active" : ""}`}
                type="button"
                onClick={() => setAmount(value)}
              >
                {value} SOL
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
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <button className="button button-accent mt-5 w-full justify-center" type="button" onClick={() => void donate()} disabled={status === "sending"}>
            {status === "sending" ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : status === "success" ? <Check aria-hidden="true" size={18} /> : <ArrowUpRight aria-hidden="true" size={18} />}
            {status === "sending" ? "Confirming on Solana" : status === "success" ? "Support sent" : `Send ${amount || "0"} SOL`}
          </button>
          <div className={`mt-3 min-h-10 text-sm leading-5 ${status === "error" ? "text-[#ff8066]" : "text-white/55"}`} role="status" aria-live="polite">
            {message}
            {signature ? (
              <a className="mt-1 flex items-center gap-1 text-[#9ccaff] hover:underline" href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">
                View transaction <ExternalLink aria-hidden="true" size={13} />
              </a>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}

