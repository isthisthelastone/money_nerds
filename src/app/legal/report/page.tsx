import { getTranslator } from "@/lib/i18n/server";
import { ReportForm } from "@/components/legal/ReportForm";

export async function generateMetadata() { return { title: (await getTranslator())("Rights and content reports"), alternates: { canonical: "/legal/report" } }; }
export default async function ReportPage() {
  const t = await getTranslator();
  return <>
    <header className="site-page-hero"><h1>{t("Rights and content reports")}</h1><p>{t("Report unlawful content, request privacy rights or challenge a moderation decision without creating an account.")}</p></header>
    <p className="site-section__intro">{t("For intimate imagery, include the exact content URL, your contact information, an electronic signature and a statement that you are the depicted person or their authorized representative and that publication was without consent. A description is enough; do not send another copy of the imagery.")}</p>
    <p className="site-section__intro">{t("Covered platforms must remove qualifying intimate imagery as soon as possible and within 48 hours after a valid notice under the US TAKE IT DOWN Act, and make reasonable efforts to remove known identical copies. Contact an emergency service if someone is in immediate danger.")}</p>
    <ReportForm />
  </>;
}
