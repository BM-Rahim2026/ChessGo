import Link from "next/link";
import type { Metadata } from "next";
import { publicClub } from "@/lib/publicClub";
import { WEEKDAYS, fmtDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { club } = await publicClub((await params).slug);
  return { title: `${club.name} · Chess club`, description: club.description ?? undefined };
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { club } = await publicClub(slug);
  const byDay = new Map<number, { time: string; group: string; location: string | null }[]>();
  for (const g of club.groups) for (const s of g.slots) {
    byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), { time: `${s.startTime}–${s.endTime}`, group: g.name, location: s.location }]);
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-5 px-4 py-10">
          {club.logoUrl ? <img src={club.logoUrl} alt={`${club.name} logo`} className="h-20 w-20 rounded-xl bg-white object-contain p-1" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/10 text-5xl">♞</div>}
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{club.name}</h1>
            {club.address && <p className="mt-1 text-white/80">{club.address}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/c/${slug}/trial`} className="rounded-lg bg-white px-4 py-2 font-medium text-brand hover:bg-brand-light">Book a free trial</Link>
            <Link href={`/c/${slug}/register`} className="rounded-lg border border-white/60 px-4 py-2 font-medium hover:bg-white/10">Register</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {club.description && <section><p className="max-w-3xl whitespace-pre-line text-lg text-stone-700">{club.description}</p></section>}

        <section>
          <h2 className="mb-4 text-xl font-semibold">Groups</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.groups.map((g) => {
              const full = g._count.students >= g.capacity;
              return (
                <div key={g.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{g.name}</h3>
                    <span className={`pill ${full ? "pill-amber" : "pill-green"}`}>{full ? "waitlist" : `${g.capacity - g._count.students} spot${g.capacity - g._count.students === 1 ? "" : "s"} left`}</span>
                  </div>
                  <p className="muted">{[g.level, g.ageRange && `ages ${g.ageRange}`].filter(Boolean).join(" · ")}</p>
                  <ul className="mt-2 text-sm">{g.slots.map((s) => <li key={s.id}>{WEEKDAYS[s.weekday]} {s.startTime}–{s.endTime}</li>)}</ul>
                  {g.coach && <p className="muted mt-2">Coach: {g.coach.name}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {byDay.size > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Weekly schedule</h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div key={d} className="rounded-lg border border-stone-200 p-3">
                  <div className="label">{WEEKDAYS[d]}</div>
                  {(byDay.get(d) ?? []).sort((a, b) => a.time.localeCompare(b.time)).map((x, i) => (
                    <div key={i} className="mt-1 text-sm"><div className="font-medium">{x.time}</div><div className="text-stone-600">{x.group}</div>{x.location && <div className="muted text-xs">{x.location}</div>}</div>
                  ))}
                  {!byDay.get(d) && <div className="muted text-xs">—</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {club.users.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Coaches</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {club.users.map((c) => (
                <div key={c.id} className="card flex gap-3">
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light text-2xl">♟</div>}
                  <div><div className="font-semibold">{c.name}</div><p className="text-sm text-stone-600">{c.bio}</p></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {club.news.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">News</h2>
            <div className="space-y-4">
              {club.news.map((n) => (
                <article key={n.id} className="border-l-4 border-brand pl-4">
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="muted">{fmtDate(n.publishedAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-stone-700">{n.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl bg-brand-light p-6">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="mt-1 text-stone-700">{[club.email, club.phone].filter(Boolean).join(" · ")}</p>
          <div className="mt-4 flex gap-2"><Link className="btn" href={`/c/${slug}/trial`}>Book a free trial</Link><Link className="btn-secondary" href={`/c/${slug}/register`}>Register</Link></div>
        </section>
      </main>
      <footer className="py-6 text-center text-xs text-stone-400">Powered by ChessGo</footer>
    </div>
  );
}
