"use client";

import { ArrowUpRight, Check, Copy, Landmark, LoaderCircle, LockKeyhole, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useId, useRef, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import { SbpBankAppAction } from "./SbpBankAppAction";
import { SBP_BANKS, isSbpBankId, sbpBankName, type SbpAvailability, type SbpBankId, type SbpTransferDetails } from "@/lib/sbp";
import styles from "./SbpFundingPanel.module.css";

type Props = { postId: number; initialBankId?: SbpBankId; standalone?: boolean };

function readAvailability(value: unknown): SbpAvailability {
  if (!value || typeof value !== "object" || !("available" in value) || value.available !== true) {
    return { available: false };
  }
  if (!("banks" in value) || !Array.isArray(value.banks)) return { available: false };
  const banks = value.banks.flatMap((bank: unknown) => {
    if (!bank || typeof bank !== "object" || !("bankId" in bank) || !isSbpBankId(bank.bankId)) return [];
    return [{ bankId: bank.bankId, hasLink: "hasLink" in bank && bank.hasLink === true }];
  });
  return banks.length ? { available: true, banks } : { available: false };
}

function readTransferDetails(value: unknown, bankId: SbpBankId): SbpTransferDetails {
  if (!value || typeof value !== "object") throw new Error("These transfer details are unavailable. Try again.");
  const details = value as Partial<SbpTransferDetails>;
  if (details.bankId !== bankId || typeof details.phone !== "string" || !/^\+7[0-9]{10}$/.test(details.phone)) {
    throw new Error("These transfer details are unavailable. Try again.");
  }
  if (details.transferUrl !== null) {
    if (typeof details.transferUrl !== "string") throw new Error("The bank transfer link is unavailable.");
    const url = new URL(details.transferUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("The bank transfer link is unavailable.");
  }
  return details as SbpTransferDetails;
}

/** The identity-keyed child never retains another account's private transfer data. */
export function SbpFundingPanel({ postId, initialBankId, standalone = false }: Props) {
  const { authenticated, session, status, retrySignIn } = useWalletSession();
  if (!authenticated || !session) {
    if (!standalone) return null;
    return (
      <section className={styles.panel} aria-label="Private bank transfer instructions">
        <LockKeyhole aria-hidden="true" size={24} />
        <h2 className={styles.title}>Private bank transfer instructions</h2>
        {status === "loading" || status === "preparing" ? (
          <p className={styles.copy} role="status">Checking your account…</p>
        ) : (
          <>
            <p className={styles.copy}>Sign in and enable experimental SBP in Funding settings to view eligible transfer instructions.</p>
            <button className={styles.primary} type="button" onClick={() => void retrySignIn()}>Sign in to continue</button>
          </>
        )}
      </section>
    );
  }
  return <PrivateSbpFundingPanel key={`${session.walletAddress}:${postId}`} postId={postId} initialBankId={initialBankId} standalone={standalone} />;
}

function PrivateSbpFundingPanel({ postId, initialBankId, standalone }: Props) {
  const selectId = useId();
  const [availability, setAvailability] = useState<SbpAvailability | null>(null);
  const [bankId, setBankId] = useState<SbpBankId | undefined>(initialBankId);
  const [details, setDetails] = useState<SbpTransferDetails | null>(null);
  const [sendingBank, setSendingBank] = useState<SbpBankId | "other" | "">("");
  const [manualVisible, setManualVisible] = useState(false);
  const [instructionUrl, setInstructionUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reload, setReload] = useState(0);
  const detailRequest = useRef<AbortController | null>(null);
  const selectedBank = availability?.available ? availability.banks.find((bank) => bank.bankId === bankId) : undefined;

  useEffect(() => {
    let controller: AbortController | null = null;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      detailRequest.current?.abort();
      setDetails(null);
      setManualVisible(false);
      setCopied(false);
      setLoading(false);
      setError("");
      setAvailability(null);
      try {
        const response = await fetch(`/api/posts/${postId}/sbp`, { cache: "no-store", credentials: "same-origin", signal });
        if (!response.ok) throw new Error("Bank transfer options could not be loaded. Try again.");
        const next = readAvailability(await response.json());
        if (signal.aborted) return;
        setAvailability(next);
        if (next.available) {
          setBankId((current) => next.banks.some((bank) => bank.bankId === current) ? current : next.banks[0].bankId);
        }
      } catch (caught) {
        if (signal.aborted) return;
        setAvailability({ available: false });
        setError(caught instanceof Error ? caught.message : "Bank transfer options could not be loaded.");
      }
    };
    // Refresh after returning from a banking app or account settings. Revoked
    // contact details must not remain on screen when the browser resumes.
    const resume = () => { if (document.visibilityState === "visible") void load(); };
    const hide = () => {
      if (document.visibilityState !== "hidden") return;
      controller?.abort();
      detailRequest.current?.abort();
      setDetails(null);
      setManualVisible(false);
      setCopied(false);
    };
    const onVisibility = () => { hide(); resume(); };
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      controller?.abort();
      detailRequest.current?.abort();
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [postId, reload]);

  const reveal = async () => {
    if (!bankId) return;
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setLoading(true);
    setError("");
    setDetails(null);
    setCopied(false);
    try {
      const response = await fetch(`/api/posts/${postId}/sbp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ bankId }),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          setAvailability({ available: false });
        }
        throw new Error("These transfer instructions are no longer available. Check Funding settings or try again.");
      }
      const next = readTransferDetails(await response.json(), bankId);
      if (controller.signal.aborted) return;
      setDetails(next);
      setManualVisible(next.transferUrl === null);
      // Only the public post ID and bank selector enter this URL, never a phone
      // number or a bank-issued personal collection link.
      setInstructionUrl(new URL(`/p/${postId}/sbp?bank=${encodeURIComponent(bankId)}`, window.location.origin).href);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : "These transfer instructions could not be loaded.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const copyPhone = async () => {
    if (!details) return;
    try {
      await navigator.clipboard.writeText(details.phone);
      setCopied(true);
      setError("");
    } catch {
      setError("Copy is unavailable in this browser. Select and copy the phone number below.");
    }
  };

  if (!availability) {
    return standalone ? <p className={styles.copy} role="status">Loading private transfer options…</p> : null;
  }
  if (!availability.available) {
    // Do not reveal whether an author opted in to viewers who cannot access it.
    if (!standalone) return null;
    return (
      <section className={styles.panel}>
        <LockKeyhole aria-hidden="true" size={24} />
        <h2 className={styles.title}>Transfer instructions are unavailable</h2>
        <p className={styles.copy}>You can view eligible instructions only when experimental SBP is enabled in your Funding settings. Availability may change.</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/settings">Funding settings</Link>
          <button className={styles.secondary} type="button" onClick={() => setReload((value) => value + 1)}>Check again</button>
        </div>
        {error ? <p className={styles.error} role="status">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label="Experimental SBP bank transfer">
      <div className={styles.heading}>
        <span className={styles.icon}><Landmark aria-hidden="true" size={21} /></span>
        <div><span className={styles.eyebrow}>Experimental · private</span><h3 className={styles.title}>Bank transfer · SBP</h3></div>
      </div>
      <p className={styles.copy}>Send rubles directly to the recipient. Money Nerds takes no fee; bank fees may apply.</p>
      <label className={styles.label} htmlFor={selectId}>Recipient’s bank</label>
      <select
        id={selectId}
        className={styles.select}
        value={bankId ?? ""}
        onChange={(event) => {
          if (!isSbpBankId(event.target.value)) return;
          detailRequest.current?.abort();
          setBankId(event.target.value);
          setDetails(null);
          setLoading(false);
          setError("");
          setCopied(false);
          setManualVisible(false);
        }}
      >
        {availability.banks.map((bank) => <option key={bank.bankId} value={bank.bankId}>{sbpBankName(bank.bankId)}{bank.hasLink ? " · bank link" : " · phone instructions"}</option>)}
      </select>
      {!details ? (
        <>
          <p className={styles.hint}>{selectedBank?.hasLink ? "The recipient supplied a bank-issued collection link. Choose your sending bank and amount on the bank’s page." : "No bank-issued link is attached for this bank. Use manual SBP instructions; your banking app will not be prefilled."}</p>
          <button className={styles.primary} type="button" disabled={loading || !selectedBank} onClick={() => void reveal()}>
            {loading ? <LoaderCircle className="spin" aria-hidden="true" size={17} /> : <LockKeyhole aria-hidden="true" size={17} />}
            {loading ? "Loading instructions…" : selectedBank?.hasLink ? "Show bank transfer" : "Show phone transfer instructions"}
          </button>
        </>
      ) : (
        <>
          <div className={styles.transfer}>
            <figure className={styles.qr}>
              <div className={styles.qrImage}><QRCodeSVG value={details.transferUrl ?? instructionUrl} size={152} level="M" title={details.transferUrl ? "Recipient’s bank-issued transfer link" : "Private Money Nerds transfer instructions"} /></div>
              <figcaption>{details.transferUrl ? "Bank-issued link QR" : "Transfer instructions QR"}</figcaption>
            </figure>
            <div className={styles.transferCopy}>
              <p className={styles.destination}>To {sbpBankName(details.bankId)}</p>
              {details.transferUrl ? (
                <>
                  <p className={styles.copy}>Open the bank’s page, then choose your sending bank and amount. Available payment methods depend on the bank.</p>
                  <a className={styles.primary} href={details.transferUrl} target="_blank" rel="noreferrer noopener"><ArrowUpRight aria-hidden="true" size={17} /> Open bank transfer</a>
                  <p className={styles.hint}>Or scan the QR with your phone camera to open the same bank-issued link.</p>
                </>
              ) : (
                <>
                  <p className={styles.copy}>Scan with your phone camera to open these private instructions. This is not a payment QR for a banking app.</p>
                  {!standalone ? <Link className={styles.primary} href={`/p/${postId}/sbp?bank=${details.bankId}`}><ArrowUpRight aria-hidden="true" size={17} /> Open transfer instructions</Link> : null}
                  <p className={styles.hint}>On another device, sign in and enable SBP there too.</p>
                </>
              )}
            </div>
          </div>
          {details.transferUrl && !manualVisible ? (
            <button className={styles.textButton} type="button" onClick={() => setManualVisible(true)}>Bank link not working? Show manual phone instructions</button>
          ) : null}
          {manualVisible ? (
            <div className={styles.manual}>
              <label className={styles.label} htmlFor={`${selectId}-sender`}>Your sending bank</label>
              <select id={`${selectId}-sender`} className={styles.select} value={sendingBank} onChange={(event) => { if (isSbpBankId(event.target.value) || event.target.value === "other" || event.target.value === "") setSendingBank(event.target.value); }}>
                <option value="">Choose your bank</option>
                {SBP_BANKS.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
                <option value="other">Another SBP bank</option>
              </select>
              <label className={styles.label} htmlFor={`${selectId}-phone`}>Recipient’s phone · provided by the recipient</label>
              <div className={styles.phoneRow}>
                <input id={`${selectId}-phone`} className={styles.phone} type="text" inputMode="tel" value={details.phone} readOnly aria-label="Recipient’s phone number" />
                <button className={styles.secondary} type="button" onClick={() => void copyPhone()}>{copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}{copied ? "Copied" : "Copy"}</button>
              </div>
              {sendingBank && sendingBank !== "other" ? <SbpBankAppAction bankId={sendingBank} /> : (
                <p className={styles.hint}>{sendingBank === "other" ? "Open your bank’s installed app and follow the steps below. We do not have a verified opening link for this bank." : "Choose your sending bank above to see its opening button and instructions."}</p>
              )}
              <ol className={styles.steps}>
                <li>Copy the recipient’s phone number, then open {sendingBank && sendingBank !== "other" ? sbpBankName(sendingBank) : "your bank"} using its button above or your installed app.</li>
                <li>Choose a transfer by phone number via SBP. Paste the number and select <strong>{sbpBankName(details.bankId)}</strong> as the recipient’s bank.</li>
                <li>Enter the amount. Check the recipient’s name, number, bank and any fee before confirming.</li>
              </ol>
            </div>
          ) : null}
        </>
      )}
      <p className={styles.warning}><ShieldAlert aria-hidden="true" size={17} /><span>Recipient details are self-declared, not verified by Money Nerds. Bank transfers are not tracked or included in verified donation totals. Never pay if the bank shows an unexpected recipient.</span></p>
      {error || copied ? <p className={error ? styles.error : styles.hint} role="status">{error || "Phone number copied."}</p> : null}
    </section>
  );
}
