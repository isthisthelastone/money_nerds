import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

const GUIDES = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/safety", label: "Safety" },
  { href: "/faq", label: "FAQ" },
  { href: "/community", label: "Community guide" },
] as const;

export function GuidePage({
  path,
  title,
  introduction,
  children,
}: {
  path: (typeof GUIDES)[number]["href"];
  title: string;
  introduction: string;
  children: ReactNode;
}) {
  const current = GUIDES.find((guide) => guide.href === path)!;

  return (
    <main className="site-page site-shell">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-white/55">
        <Link className="hover:text-[#c9ff55]" href="/">Money Nerds</Link>
        <ChevronRight aria-hidden="true" size={14} />
        <span aria-current="page">{current.label}</span>
      </nav>
      <header className="site-page-hero">
        <p className="site-kicker">{current.label}</p>
        <h1>{title}</h1>
        <p className="site-page-hero__lede">{introduction}</p>
      </header>
      <nav aria-label="Money Nerds guides" className="mt-8 flex flex-wrap gap-2">
        {GUIDES.map((guide) => (
          <Link
            key={guide.href}
            href={guide.href}
            aria-current={guide.href === path ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm transition ${
              guide.href === path
                ? "border-[#c9ff55]/40 bg-[#c9ff55]/10 text-[#dfff9c]"
                : "border-white/15 text-white/65 hover:border-white/35 hover:text-white"
            }`}
          >
            {guide.label}
          </Link>
        ))}
      </nav>
      {children}
      <section className="site-callout" aria-labelledby="guide-board-title">
        <div>
          <p className="site-kicker">Start with a real person</p>
          <h2 id="guide-board-title">Find an ask that speaks to you.</h2>
          <p>Browse without signing in. Read the context, ask questions, and choose whether to support.</p>
        </div>
        <Link className="site-button site-button--primary" href="/#feed">
          Browse the board <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </section>
    </main>
  );
}

export function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="site-section" aria-labelledby={id}>
      <h2 className="site-section__heading" id={id}>{title}</h2>
      {children}
    </section>
  );
}
