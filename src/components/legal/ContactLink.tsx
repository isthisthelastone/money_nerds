"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { CONTACT_EMAIL_READY, LEGAL_CONTACT } from "@/lib/legal/content";

export const CONTACT_PENDING_MESSAGE = "Contact email is being set up. Please do not send messages yet.";

/** No personal-address fallback and no mailto action for an unverified inbox. */
export function ContactLink({ label, className }: { label?: string; className?: string }) {
  const { t } = useI18n();
  return CONTACT_EMAIL_READY
    ? <a className={className} href={`mailto:${LEGAL_CONTACT}`}>{label ?? LEGAL_CONTACT}</a>
    : <Link className={className} href="/legal/report" title={t(CONTACT_PENDING_MESSAGE)}>{label ?? LEGAL_CONTACT}</Link>;
}

export function ContactStatus() {
  const { t } = useI18n();
  return CONTACT_EMAIL_READY ? null : <p role="status" className="contact-pending">{t(CONTACT_PENDING_MESSAGE)}</p>;
}
