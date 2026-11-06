import Link from "next/link";
import type { Metadata } from "next";
import { publicClub } from "@/lib/publicClub";
import { WEEKDAYS, fmtDate } from "@/lib/format";
import { Logo, CrownC } from "@/components/Brand";

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
    <div className="min-h-screen bg-cream">
      <header className="border-b border-ink/10 bg-cream">
        <div className="mx-auto max-w-5xl px-4 py-8">
          {/* Co-branding: ChessGo first, quiet divider, then the club. Never merge or recolour the marks. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-learner bg-white px-4 py-3">
            <Logo width={200} />
            <span className="hidden h-14 w-px bg-ink/15 sm:block" aria-hidden />
            {club.logoUrl && <img src={club.logoUrl} alt={`${club.name} logo`} className="h-14 w-auto max-w-[160px] object-contain" />}
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">Chess club</p>
              <h1 className="font-display text-2xl font-semibold leading-8 text-forest">{club.name}</h1>
              {club.address && <p className="text-sm text-ink-soft">{club.address}</p>}
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="font-display text-[28px] font-semibold leading-9 text-forest">Small moves. Big progress.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/c/${slug}/trial`} className="btn btn-lg">Book a free trial</Link>
              <Link href={`/c/${slug}/register`} className="btn-secondary btn-lg">Register</Link>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        {club.description && <section><p className="max-w-3xl whitespace-pre-line text-lg text-ink">{club.description}</p></section>}

        <section>
          <h2 className="h2 mb-4">Groups</h2>
          {club.groups.length === 0 && <p className="muted">Group times will be published here soon. Book a free trial and we&apos;ll find the right group together.</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.groups.map((g) => {
              const full = g._count.students >= g.capacity;
              return (
                <div key={g.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold text-forest">{g.name}</h3>
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
            <h2 className="h2 mb-4">Weekly schedule</h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <div key={d} className="rounded-control border border-ink/15 p-3">
                  <div className="label">{WEEKDAYS[d]}</div>
                  {(byDay.get(d) ?? []).sort((a, b) => a.time.localeCompare(b.time)).map((x, i) => (
                    <div key={i} className="mt-1 text-sm"><div className="font-medium">{x.time}</div><div className="text-ink-soft">{x.group}</div>{x.location && <div className="muted text-xs">{x.location}</div>}</div>
                  ))}
                  {!byDay.get(d) && <div className="muted text-xs">—</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {club.users.length > 0 && (
          <section>
            <h2 className="h2 mb-4">Coaches</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {club.users.map((c) => (
                <div key={c.id} className="card flex gap-3">
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-mint"><CrownC size={36} /></div>}
                  <div><div className="font-semibold">{c.name}</div><p className="text-sm text-ink-soft">{c.bio}</p></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {club.news.length > 0 && (
          <section>
            <h2 className="h2 mb-4">News</h2>
            <div className="space-y-4">
              {club.news.map((n) => (
                <article key={n.id} className="border-l-4 border-brand pl-4">
                  <h3 className="font-semibold">{n.title}</h3>
                  <p className="muted">{fmtDate(n.publishedAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-ink">{n.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-learner bg-mint p-6">
          <h2 className="h2">Contact</h2>
          <p className="mt-1 text-ink">{[club.email, club.phone].filter(Boolean).join(" · ")}</p>
          <div className="mt-4 flex gap-2"><Link className="btn" href={`/c/${slug}/trial`}>Book a free trial</Link><Link className="btn-secondary" href={`/c/${slug}/register`}>Register</Link></div>
        </section>
      </main>
      <footer className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft"><CrownC size={32} /> Powered by ChessGo</footer>
    </div>
  );
}
