import type { Metadata } from "next";
import { SbpSettingsForm } from "@/components/features/SbpSettingsForm";
import styles from "@/components/features/SbpSettings.module.css";
import { PreferencesSettings } from "@/components/site/PreferencesSettings";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("Funding settings"), description: t("Manage your optional Money Nerds funding preferences."), robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
}

export default async function FundingSettingsPage() {
  const t = await getTranslator();
  return (
    <main className={`site-shell ${styles.page}`}>
      <header className={styles.pageHeader}>
        <p className="site-kicker">{t("Your account · Funding")}</p>
        <h1>{t("More ways to help.")}</h1>
        <p>{t("Choose the funding options you want to use. Nothing extra is enabled by default.")}</p>
      </header>
      <PreferencesSettings />
      <SbpSettingsForm />
    </main>
  );
}
