import Link from "next/link";
import { Logo } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export type NavItem = { href: string; label: string; icon?: string };

export async function Shell({ title, sub, nav, userName, children }: {
  title: string; sub?: string; nav: NavItem[]; userName: string; children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = makeT(locale);
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="border-b border-ink/10 bg-white md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-start justify-between gap-2 px-3 pt-3 md:block">
          <Link href="/" aria-label={t("ChessGo home")}><Logo width={180} /></Link>
          <LanguageSwitch locale={locale} className="mt-3 md:hidden" />
        </div>
        <div className="px-6 pb-3">
          <div className="truncate font-display font-semibold text-forest">{title}</div>
          {sub && <div className="truncate text-sm text-ink-soft">{sub}</div>}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex min-h-[40px] items-center whitespace-nowrap rounded-control px-3 text-[15px] text-ink hover:bg-mint hover:text-forest">
              <span className="mr-2 inline-block w-5 text-center" aria-hidden>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-ink/10 px-5 py-4 text-sm text-ink-soft md:block">
          <LanguageSwitch locale={locale} className="mb-3" />
          <div className="truncate">{userName}</div>
          <Link href="/account" className="mt-1 block underline">{t("Account & password")}</Link>
          <form action="/logout" method="post"><button className="mt-1 underline">{t("Sign out")}</button></form>
          <div className="mt-3 flex flex-wrap gap-x-3 text-xs"><Link href="/regulamin" className="underline">{t("Terms of service")}</Link><Link href="/polityka-prywatnosci" className="underline">{t("Privacy policy")}</Link></div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8">
        {children}
        <div className="mt-10 flex gap-4 md:hidden"><Link href="/account" className="muted underline">{t("Account & password")}</Link><form action="/logout" method="post"><button className="muted underline">{t("Sign out")}</button></form></div>
      </main>
    </div>
  );
}
