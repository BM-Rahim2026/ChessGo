"use client";
import type { Locale } from "@/lib/i18n/core";

/** PL | EN switch. Posts to /api/locale and returns to the same page; the choice is remembered. */
export function LanguageSwitch({ locale, className = "" }: { locale: Locale; className?: string }) {
  return (
    <form action="/api/locale" method="post" aria-label="Język / Language"
      onSubmit={(e) => { (e.currentTarget.elements.namedItem("back") as HTMLInputElement).value = location.pathname + location.search; }}
      className={`inline-flex rounded-control border border-forest/30 bg-white p-0.5 text-sm ${className}`}>
      <input type="hidden" name="back" defaultValue="/" />
      {(["pl", "en"] as const).map((l) => (
        <button key={l} name="to" value={l} aria-pressed={locale === l} lang={l} title={l === "pl" ? "Polski" : "English"}
          className={`min-h-[36px] min-w-[44px] rounded-[10px] px-2 font-semibold ${locale === l ? "bg-forest text-white" : "text-forest hover:bg-mint"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
