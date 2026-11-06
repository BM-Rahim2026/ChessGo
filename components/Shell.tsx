import Link from "next/link";

export type NavItem = { href: string; label: string; icon?: string };

export function Shell({ title, sub, nav, userName, children }: {
  title: string; sub?: string; nav: NavItem[]; userName: string; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <aside className="border-b border-stone-200 bg-white md:min-h-screen md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="text-2xl">♞</span>
          <div className="min-w-0">
            <div className="truncate font-semibold">{title}</div>
            {sub && <div className="truncate text-xs text-stone-500">{sub}</div>}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-brand-light hover:text-brand-dark">
              <span className="mr-2 inline-block w-4 text-center">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-stone-100 px-4 py-3 text-xs text-stone-500 md:block">
          <div className="truncate">{userName}</div>
          <form action="/logout" method="post"><button className="mt-1 underline">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8">
        {children}
        <form action="/logout" method="post" className="mt-10 md:hidden"><button className="muted underline">Sign out</button></form>
      </main>
    </div>
  );
}
