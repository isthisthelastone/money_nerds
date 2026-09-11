import { ArrowUpRight, Smartphone } from "lucide-react";
import { sbpBankName, type SbpBankId } from "@/lib/sbp";
import { SBP_SENDING_BANK_GUIDES } from "@/lib/sbp-bank-apps";
import styles from "./SbpFundingPanel.module.css";

/** Only public, bank-published destinations. Never append recipient details. */
export function SbpBankAppAction({ bankId }: { bankId: SbpBankId }) {
  const guide = SBP_SENDING_BANK_GUIDES[bankId];
  const name = sbpBankName(bankId);
  const opensApp = guide.kind === "transfer" || guide.kind === "app";

  return (
    <div className={styles.bankAction}>
      <div className={styles.bankActionHeading}>
        <span className={styles.bankActionIcon}><Smartphone aria-hidden="true" size={21} /></span>
        <div>
          <p className={styles.eyebrow}>Send from {name}</p>
          <p className={styles.bankActionTitle}>{opensApp ? "Open your bank application" : guide.kind === "online" ? "Continue in your bank" : guide.kind === "app-options" ? "Find your bank application" : "Continue with your bank’s guide"}</p>
        </div>
      </div>
      <p className={styles.copy}>{guide.note}</p>
      <div className={styles.actions}>
        <a className={styles.primary} href={guide.openUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          <ArrowUpRight aria-hidden="true" size={17} />
          {opensApp ? "Open your bank application" : guide.kind === "online" ? `Open ${name} online` : guide.kind === "app-options" ? `Open ${name} app options` : `Open ${name} transfer guide`}
        </a>
        {guide.helpUrl !== guide.openUrl ? <a className={styles.secondary} href={guide.helpUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          Bank’s instructions <ArrowUpRight aria-hidden="true" size={15} />
        </a> : null}
      </div>
      <p className={styles.bankPath}><span>In {name}</span>{guide.navigation}</p>
      <p className={styles.hint}>Copy the number before leaving this page. Paste it in the bank and choose the recipient’s bank shown below. Nothing is sent automatically.</p>
    </div>
  );
}
