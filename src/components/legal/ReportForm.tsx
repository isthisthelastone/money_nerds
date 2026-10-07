"use client";
import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { LEGAL_CONTACT } from "@/lib/legal/content";

export function ReportForm() {
  const { t } = useI18n();
  const [kind, setKind] = useState("content");
  return <form className="preferences-card" onSubmit={(event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = [
      `Request type: ${kind}`, `Public URL or account: ${values.get("url")}`,
      `Name / representative: ${values.get("name")}`, `Reply contact: ${values.get("email")}`,
      `Explanation: ${values.get("details")}`, `Requested action: ${values.get("action")}`,
      `Electronic signature: ${values.get("signature")}`,
      values.get("goodFaith") ? "I confirm in good faith that the information is accurate. For intimate imagery, I am the depicted person or their authorized representative and the depiction was published without consent." : "",
    ].filter(Boolean).join("\n\n");
    window.location.href = `mailto:${LEGAL_CONTACT}?subject=${encodeURIComponent(`Money Nerds ${kind} request`)}&body=${encodeURIComponent(body)}`;
  }}>
    <label className="grid gap-2">{t("Request type")}<select name="kind" className="feed-select" value={kind} onChange={(event) => setKind(event.target.value)}>
      <option value="content">{t("Illegal content or abuse")}</option>
      <option value="intimate-imagery">{t("Nonconsensual intimate imagery")}</option>
      <option value="copyright">{t("Copyright")}</option>
      <option value="privacy">{t("Privacy rights")}</option>
      <option value="appeal">{t("Appeal a moderation decision")}</option>
    </select></label>
    <label className="grid gap-2">{t("Public URL or account") }<input name="url" className="feed-select w-full" required maxLength={500} /></label>
    <label className="grid gap-2">{t("Your name or representative") }<input name="name" className="feed-select w-full" maxLength={120} required={kind === "intimate-imagery" || kind === "copyright"} /></label>
    <label className="grid gap-2">{t("Reply email") }<input name="email" type="email" className="feed-select w-full" autoComplete="email" maxLength={254} required /></label>
    <label className="grid gap-2">{t("Explain the issue and where the content appears") }<textarea name="details" className="feed-select w-full" rows={5} maxLength={2000} required /></label>
    <label className="grid gap-2">{t("Requested action") }<input name="action" className="feed-select w-full" maxLength={300} required /></label>
    <label className="grid gap-2">{t("Electronic signature (type your name)") }<input name="signature" className="feed-select w-full" maxLength={120} required={kind === "intimate-imagery" || kind === "copyright"} /></label>
    <label className="flex items-start gap-3"><input name="goodFaith" type="checkbox" required className="mt-1 size-5" /><span>{t("I confirm in good faith that this report is accurate. For intimate imagery, I am the depicted person or their authorized representative and publication was without consent.")}</span></label>
    <p>{t("Do not attach intimate images, passwords, identity documents or wallet secrets. Identify the existing content using its URL.")}</p>
    <button className="button button-secondary" type="submit">{t("Open email draft")}</button>
    <p>{t("This opens your email app. Review and send the email to submit your request; this page does not send it or display a false receipt.")}</p>
    <a className="privacy-link break-all" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
  </form>;
}
