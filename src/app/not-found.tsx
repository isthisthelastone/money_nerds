import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";

export default async function NotFoundPage() {
  const t = await getTranslator();
  return <main className="site-shell grid min-h-[55svh] content-center gap-5 py-12">
    <p className="site-kicker">404</p>
    <h1 className="text-3xl font-semibold">{t("Page not found")}</h1>
    <p className="max-w-xl text-white/65">{t("This page is unavailable or the link has changed.")}</p>
    <Link className="button button-secondary justify-self-start" href="/">{t("Back to the board")}</Link>
  </main>;
}
