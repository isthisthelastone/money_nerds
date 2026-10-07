"use client";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return <main className="site-shell grid min-h-[55svh] content-center gap-5 py-12">
    <h1 className="text-3xl font-semibold">{t("This page could not be loaded")}</h1>
    <p className="max-w-xl text-white/65">{t("Please retry. Your account and published content have not been changed.")}</p>
    <div className="flex flex-wrap gap-3"><button className="button button-secondary" type="button" onClick={reset}>{t("Try again")}</button><Link className="button button-secondary" href="/">{t("Back to the board")}</Link></div>
  </main>;
}
