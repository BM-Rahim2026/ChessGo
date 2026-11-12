"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/core";

/**
 * PL | EN switch. With JavaScript: saves the choice in a cookie and re-renders the current page
 * in one request (no redirect). Without JavaScript: posts to /api/locale and returns to the page.
 */
export function LanguageSwitch({ locale, className = "" }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useState(locale);
  return (
    <form action="/api/locale" method="post" aria-label="Język / Language" aria-busy={pending}
      onSubmit={(e) => {
        const to = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value as Locale | undefined;
        if (!to) { (e.currentTarget.elements.namedItem("back") as HTMLInputElement).value = location.pathname + location.search; return; }
        e.preventDefault();
        if (to === shown) return;
        setShown(to);
        document.cookie = `${LOCALE_COOKIE}=${to}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
        document.documentElement.lang = to;
        start(() => router.refresh());
      }}
      className={`inline-flex rounded-control border border-forest/30 bg-white p-0.5 text-sm ${pending ? "opacity-70" : ""} ${className}`}>
      <input type="hidden" name="back" defaultValue="/" />
      {(["pl", "en"] as const).map((l) => (
        <button key={l} name="to" value={l} aria-pressed={shown === l} lang={l} title={l === "pl" ? "Polski" : "English"}
          className={`min-h-[36px] min-w-[44px] rounded-[10px] px-2 font-semibold ${shown === l ? "bg-forest text-white" : "text-forest hover:bg-mint"}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
