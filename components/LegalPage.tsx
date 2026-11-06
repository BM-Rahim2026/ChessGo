import Link from "next/link";
import { Logo } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import type { Locale } from "@/lib/i18n/core";

export type Block = string | { list: string[] } | { ordered: string[] } | { note: string };
export type Section = { id?: string; h: string; body: Block[] };

/** Shared layout for the legal pages: brand header, table of contents, readable typography. */
export function LegalPage({ locale, title, updated, intro, sections, other }: {
  locale: Locale; title: string; updated: string; intro?: string; sections: Section[];
  other: { href: string; label: string }[];
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1">
          <Link href="/" aria-label="ChessGo"><Logo width={180} /></Link>
          <LanguageSwitch locale={locale} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="h1">{title}</h1>
        <p className="muted mt-1">{updated}</p>
        {intro && <p className="mt-4 text-ink">{intro}</p>}
        <nav aria-label="Spis treści" className="card mt-6">
          <ol className="list-decimal space-y-1 pl-5 text-[15px]">
            {sections.map((s, i) => <li key={i}><a className="text-forest underline" href={`#s${i + 1}`}>{s.h}</a></li>)}
          </ol>
        </nav>
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={i} id={`s${i + 1}`} className="scroll-mt-6">
              <h2 className="h2">{i + 1}. {s.h}</h2>
              <div className="mt-3 space-y-3 text-[15px] leading-7 text-ink">
                {s.body.map((b, j) =>
                  typeof b === "string" ? <p key={j}>{b}</p>
                  : "list" in b ? <ul key={j} className="list-disc space-y-1 pl-5">{b.list.map((x, k) => <li key={k}>{x}</li>)}</ul>
                  : "ordered" in b ? <ol key={j} className="list-decimal space-y-1 pl-5">{b.ordered.map((x, k) => <li key={k}>{x}</li>)}</ol>
                  : <p key={j} className="whitespace-pre-line rounded-card bg-mint p-4 text-sm">{b.note}</p>,
                )}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-4 border-t border-ink/10 pt-6 text-sm">
          {other.map((o) => <Link key={o.href} href={o.href} className="font-semibold text-forest underline">{o.label}</Link>)}
          <Link href="/" className="text-forest underline">ChessGo</Link>
        </div>
      </main>
    </div>
  );
}
