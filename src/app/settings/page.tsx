import type { Metadata } from "next";
import { SbpSettingsForm } from "@/components/features/SbpSettingsForm";
import styles from "@/components/features/SbpSettings.module.css";

export const metadata: Metadata = {
  title: "Funding settings",
  description: "Manage your optional Money Nerds funding preferences.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function FundingSettingsPage() {
  return (
    <main className={`site-shell ${styles.page}`}>
      <header className={styles.pageHeader}>
        <p className="site-kicker">Your account · Funding</p>
        <h1>More ways to help.</h1>
        <p>Choose the funding options you want to use. Nothing extra is enabled by default.</p>
      </header>
      <SbpSettingsForm />
    </main>
  );
}
