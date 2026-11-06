import Link from "next/link";
import { Logo } from "./Brand";

export type NavItem = { href: string; label: string; icon?: string };

export function Shell({ title, sub, nav, userName, children }: {
  title: string; sub?: string; nav: NavItem[]; userName: string; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="border-b border-ink/10 bg-white md:min-h-screen md:border-b-0 md:border-r">
        <div className="px-3 pt-3">
          <Link href="/" aria-label="ChessGo home"><Logo width={180} /></Link>
          <div className="px-3 pb-3">
            <div className="truncate font-display font-semibold text-forest">{title}</div>
            {sub && <div className="truncate text-sm text-ink-soft">{sub}</div>}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex min-h-[40px] items-center whitespace-nowrap rounded-control px-3 text-[15px] text-ink hover:bg-mint hover:text-forest">
              <span className="mr-2 inline-block w-5 text-center" aria-hidden>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-ink/10 px-5 py-4 text-sm text-ink-soft md:block">
          <div className="truncate">{userName}</div>
          <Link href="/account" className="mt-1 block underline">Account & password</Link>
          <form action="/logout" method="post"><button className="mt-1 underline">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8">
        {children}
        <div className="mt-10 flex gap-4 md:hidden"><Link href="/account" className="muted underline">Account & password</Link><form action="/logout" method="post"><button className="muted underline">Sign out</button></form></div>
      </main>
    </div>
  );
}
