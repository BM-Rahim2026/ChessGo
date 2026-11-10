import Link from "next/link";
import { Logo } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { currentUser, homeFor } from "@/lib/auth";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const [user, locale] = await Promise.all([currentUser(), getLocale()]);
  const t = makeT(locale);
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1">
          <Link href="/" aria-label="ChessGo"><Logo width={160} /></Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch locale={locale} className="hidden sm:inline-flex" />
            {user && !user.mustChangePassword
              ? <a href={homeFor(user.role)} className="btn-secondary whitespace-nowrap px-3">{t("Go to my panel")}</a>
              : <Link href="/login" className="btn-secondary whitespace-nowrap px-3">{t("Sign in")}</Link>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
