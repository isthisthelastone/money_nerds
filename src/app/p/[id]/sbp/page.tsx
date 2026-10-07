import { getTranslator } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SbpFundingPanel } from "@/components/features/SbpFundingPanel";
import { isSbpBankId } from "@/lib/sbp";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
  title: t("Private bank transfer instructions"),
  description: t("Experimental, opt-in SBP transfer instructions. Sign in to view eligible bank transfer details."),
  robots: { index: false, follow: false, noarchive: true },
};
}

export default async function SbpInstructionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bank?: string | string[] }>;
}) {
  const t = await getTranslator();
  const [route, query] = await Promise.all([params, searchParams]);
  const id = Number(route.id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const bankId = isSbpBankId(query.bank) ? query.bank : undefined;

  return (
    <main className="site-shell pb-20 pt-10 sm:pt-14">
      <div className="mx-auto max-w-2xl">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition hover:text-white" href={`/p/${id}`}>
          <ArrowLeft aria-hidden="true" size={16} /> {t("Back to the post")} </Link>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#cbbaff]">{t("Direct support · experimental")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#f2efe6]">{t("Continue on your phone")}</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">{t("Bank transfers happen in your banking app. This private page helps you find eligible recipient instructions; it does not send or confirm a payment.")}</p>
        <SbpFundingPanel postId={id} initialBankId={bankId} standalone />
      </div>
    </main>
  );
}
