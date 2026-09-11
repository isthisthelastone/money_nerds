"use client";

import { ArrowUpRight, Check, FlaskConical, Landmark, LoaderCircle, LockKeyhole, Save } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";
import { useWalletSession } from "@/components/providers/WalletSessionProvider";
import {
  EMPTY_SBP_SETTINGS,
  SBP_BANKS,
  SBP_LINK_GUIDES,
  canReceiveSbp,
  sbpPhoneDigits,
  type SbpBankId,
  type SbpSettings,
} from "@/lib/sbp";
import styles from "./SbpSettings.module.css";

export function SbpSettingsForm() {
  const { authenticated, session, status, retrySignIn } = useWalletSession();
  if (status === "loading" || status === "preparing") {
    return (
      <div className={styles.panel} role="status">
        <p className={styles.inline}><LoaderCircle className="spin" size={18} aria-hidden="true" /> Preparing your settings…</p>
      </div>
    );
  }
  if (!authenticated || !session) {
    return (
      <section className={styles.panel} aria-labelledby="settings-sign-in-title">
        <LockKeyhole size={24} aria-hidden="true" className={styles.accent} />
        <h2 id="settings-sign-in-title">Your preferences stay with your account.</h2>
        <p className={styles.muted}>Sign in to enable experimental SBP transfers and manage your receiving details.</p>
        {status === "error" ? (
          <button type="button" className="button button-accent" onClick={() => void retrySignIn()}>Retry your profile</button>
        ) : (
          <Link className="button button-accent" href="/sign-in?redirect_url=%2Fsettings">Sign in to continue</Link>
        )}
      </section>
    );
  }
  return <AuthenticatedSbpSettings key={session.walletAddress} />;
}

function AuthenticatedSbpSettings() {
  const { invalidateSession } = useWalletSession();
  const phoneId = useId();
  const privacyId = useId();
  const [saved, setSaved] = useState<SbpSettings>(EMPTY_SBP_SETTINGS);
  const [enabled, setEnabled] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [banks, setBanks] = useState<SbpSettings["banks"]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/settings/sbp", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as SbpSettings & { error?: string };
        if (!response.ok) {
          if (response.status === 401) invalidateSession();
          throw new Error(payload.error ?? "Your SBP settings could not be loaded.");
        }
        if (controller.signal.aborted) return;
        setSaved(payload);
        setEnabled(payload.enabled);
        setPhoneDigits(sbpPhoneDigits(payload.phone ?? ""));
        setBanks(payload.banks);
        setLoaded(true);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Settings could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [invalidateSession, retry]);

  const draft: SbpSettings = {
    enabled,
    phone: enabled && phoneDigits ? `+7${phoneDigits}` : null,
    banks: enabled ? banks.map((bank) => ({ ...bank, transferUrl: bank.transferUrl?.trim() || null })) : [],
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const readyToReceive = canReceiveSbp(draft);

  const toggleBank = (bankId: SbpBankId) => {
    setBanks((current) => current.some((bank) => bank.bankId === bankId)
      ? current.filter((bank) => bank.bankId !== bankId)
      : [...current, { bankId, transferUrl: null }]);
    setSuccess(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loaded || saving) return;
    setError(null);
    setSuccess(null);
    if (enabled && phoneDigits.length > 0 && phoneDigits.length !== 10) {
      setError("Enter exactly 10 digits after +7, or leave the phone field empty to only send support.");
      return;
    }
    if (enabled && ((phoneDigits.length > 0) !== (banks.length > 0))) {
      setError("To receive transfers, add both your full phone number and at least one receiving bank. Leave both empty to only send support.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/settings/sbp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json() as SbpSettings & { error?: string };
      if (!response.ok) {
        if (response.status === 401) invalidateSession();
        throw new Error(payload.error ?? "Your settings could not be saved.");
      }
      setSaved(payload);
      setEnabled(payload.enabled);
      setPhoneDigits(sbpPhoneDigits(payload.phone ?? ""));
      setBanks(payload.banks);
      setSuccess(payload.enabled
        ? canReceiveSbp(payload)
          ? "Saved. SBP is enabled. Choose whether to include it each time you publish a post."
          : "Saved. You can now view SBP options on participating posts. Receiving support remains optional."
        : "SBP is off. Saved receiving details have been removed and earlier posts no longer offer SBP.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.panel} onSubmit={save} aria-label="Experimental SBP settings">
      <div className={styles.heading}>
        <div className={styles.icon}><Landmark size={23} aria-hidden="true" /></div>
        <div>
          <span className={styles.badge}><FlaskConical size={12} aria-hidden="true" /> Experimental</span>
          <h2>SBP personal transfers</h2>
          <p className={styles.muted}>Support someone directly through Russia’s Faster Payments System (СБП).</p>
        </div>
      </div>

      {loading ? (
        <p className={styles.inline} role="status"><LoaderCircle className="spin" size={17} aria-hidden="true" /> Loading your preferences…</p>
      ) : loaded ? (
        <>
          <label className={styles.switchRow}>
            <span><strong>Enable SBP transfers</strong><small>Off by default. Enable it to see SBP options on participating posts. Changes apply when you save.</small></span>
            <input
              type="checkbox"
              role="switch"
              checked={enabled}
              disabled={saving}
              aria-describedby={privacyId}
              onChange={(event) => { setEnabled(event.target.checked); setSuccess(null); }}
            />
          </label>
          <div className={styles.privacy} id={privacyId}>
            <LockKeyhole size={17} aria-hidden="true" />
            <p>Only signed-in people who also enable SBP can access receiving details on posts you individually opt in. Those people can still copy or share your phone number and bank links. Do not publish details you cannot accept being shared.</p>
          </div>

          {enabled ? (
            <fieldset className={styles.receiving} disabled={saving}>
              <legend>Receive support <span>Optional</span></legend>
              <p className={styles.muted}>Only want to send support? Leave both the number and bank choices empty. To receive, add your own number and the banks connected to it.</p>
              <p className={styles.muted}>Each opted-in post keeps the receiving details saved when it was published. Changing your number or banks here affects new posts only; it does not redirect support on earlier posts. Turn SBP off and save to remove those earlier receiving details permanently.</p>
              <div className={styles.phoneField}>
                <label htmlFor={phoneId}>Phone number linked to SBP</label>
                <div className={styles.phoneInput}>
                  <span aria-hidden="true">+7</span>
                  <input
                    id={phoneId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={phoneDigits}
                    aria-label="SBP phone number: 10 digits after plus seven"
                    placeholder="9001234567"
                    onChange={(event) => { setPhoneDigits(sbpPhoneDigits(event.target.value)); setSuccess(null); }}
                    onPaste={(event) => {
                      const pasted = event.clipboardData.getData("text");
                      if (!pasted) return;
                      event.preventDefault();
                      setPhoneDigits(sbpPhoneDigits(pasted));
                      setSuccess(null);
                    }}
                  />
                </div>
                <small>The +7 prefix stays fixed. Enter the remaining 10 digits.</small>
              </div>
              <div className={styles.bankHeading}><h3>Your receiving banks</h3><p className={styles.muted}>Select only banks where this number can receive personal transfers.</p></div>
              <div className={styles.bankGrid}>
                {SBP_BANKS.map((bank) => {
                  const selected = banks.some((item) => item.bankId === bank.id);
                  return (
                    <label className={`${styles.bankChoice} ${selected ? styles.bankSelected : ""}`} key={bank.id}>
                      <input type="checkbox" checked={selected} onChange={() => toggleBank(bank.id)} />
                      <span>{bank.name}</span>
                    </label>
                  );
                })}
              </div>
              {banks.length > 0 ? (
                <div className={styles.links}>
                  <h3>Bank-issued collection links <span>Optional</span></h3>
                  <p className={styles.muted}>A supported link created in your bank can give supporters a QR code and an “Open transfer” button. Currently, this supports Alfa-Bank personal collection links and T-Bank’s full collection URLs, not shortened links. Other banks use manual SBP instructions. Money Nerds cannot create a bank transfer link from a phone number alone.</p>
                  {banks.map((bank) => {
                    const help = SBP_LINK_GUIDES[bank.bankId];
                    if (!help) return null;
                    const name = SBP_BANKS.find((item) => item.id === bank.bankId)?.name ?? bank.bankId;
                    return (
                      <label className={styles.linkField} key={bank.bankId}>
                        <span>{name} · Personal collection link</span>
                        <input
                          type="url"
                          value={bank.transferUrl ?? ""}
                          maxLength={1024}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder={help.placeholder}
                          onChange={(event) => {
                            const transferUrl = event.target.value;
                            setBanks((current) => current.map((item) => item.bankId === bank.bankId ? { ...item, transferUrl } : item));
                            setSuccess(null);
                          }}
                        />
                        <a href={help.url} target="_blank" rel="noopener noreferrer">{help.label}<ArrowUpRight size={13} aria-hidden="true" /></a>
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {readyToReceive ? <p className={styles.ready}><Check size={16} aria-hidden="true" /> Ready to add SBP to new posts after saving. It stays unchecked in every new post.</p> : null}
            </fieldset>
          ) : null}

          {!enabled && saved.enabled ? (
            <p className={styles.warning}>Saving with SBP off removes your saved number and bank links, and permanently disables SBP on your earlier posts. Turning it back on will not restore SBP on those posts.</p>
          ) : null}
          <p className={styles.finePrint}>Money Nerds takes no platform fee. Bank fees may apply. Confirm the recipient’s name and the amount in your bank before sending. SBP transfers are not verified by Money Nerds and do not appear in verified donation totals.</p>
        </>
      ) : null}

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {success ? <p className={styles.ready} role="status"><Check size={16} aria-hidden="true" />{success}</p> : null}
      <div className={styles.actions}>
        {loaded ? (
          <button type="submit" className="button button-accent" disabled={saving || !dirty}>
            {saving ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {saving ? "Saving…" : "Save preferences"}
          </button>
        ) : !loading ? (
          <button className="button button-secondary" type="button" onClick={() => { setLoading(true); setError(null); setRetry((value) => value + 1); }}>Retry loading</button>
        ) : null}
        <Link href="/" className={styles.backLink}>Back to the board<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>
    </form>
  );
}
