import Link from "next/link";
import { db } from "@/lib/db";
import { portalContext, level } from "@/lib/portal";
import { groupLeaderboard, evaluateBadges, ensureDefaultBadges, moveTrail } from "@/lib/gamification";
import { PageHeader, Pill, Empty } from "@/components/ui";
import { Leaderboard } from "@/components/Leaderboard";
import { MoveTrail, LeagueBadge, Medal } from "@/components/Brand";
import { dayKey, money, fmtDate } from "@/lib/format";

async function ChildCard({ id, isStudent, currency }: { id: string; isStudent: boolean; currency: string }) {
  await evaluateBadges(id);
  const s = await db.student.findUniqueOrThrow({
    where: { id },
    include: { group: true, badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } }, feeInvoices: { where: { paidAt: null }, orderBy: { period: "asc" } } },
  });
  const [att, board, allBadges, daily, trail, tournaments] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], where: { studentId: id }, _count: true }),
    s.groupId ? groupLeaderboard(s.groupId) : Promise.resolve([]),
    db.badge.findMany({ where: { clubId: s.clubId }, orderBy: { threshold: "asc" } }),
    db.puzzle.findFirst({ where: { clubId: s.clubId, dailyDate: dayKey() }, include: { solves: { where: { studentId: id } } } }),
    moveTrail(id, 7),
    db.tournament.findMany({ where: { status: "finished", entries: { some: { studentId: id } } }, include: { games: true, entries: true }, orderBy: { date: "desc" }, take: 5 }),
  ]);
  const a = Object.fromEntries(att.map((r) => [r.status, r._count]));
  const marked = att.reduce((x, r) => x + r._count, 0);
  const rate = marked ? Math.round((((a.present ?? 0) + (a.late ?? 0)) / marked) * 100) : null;
  const lv = level(s.xp);
  const trailDays = trail.filter((t) => t.done).length;
  const owned = new Set(s.badges.map((b) => b.badgeId));
  const now = new Date();
  // Tournament medals: place by points (1–3) or participation.
  const medals = tournaments.map((t) => {
    const pts = new Map(t.entries.map((e) => [e.studentId, 0]));
    for (const g of t.games) {
      if (g.result === "1-0") pts.set(g.whiteId, (pts.get(g.whiteId) ?? 0) + 1);
      else if (g.result === "0-1") pts.set(g.blackId, (pts.get(g.blackId) ?? 0) + 1);
      else if (g.result === "1/2-1/2") { pts.set(g.whiteId, (pts.get(g.whiteId) ?? 0) + 0.5); pts.set(g.blackId, (pts.get(g.blackId) ?? 0) + 0.5); }
    }
    const mine = pts.get(id) ?? 0;
    const place = t.winnerId === id ? 1 : 1 + [...pts.values()].filter((p) => p > mine).length;
    return { name: t.name, date: t.date, place: (place <= 3 ? place : 0) as 0 | 1 | 2 | 3 };
  });

  return (
    <div className="space-y-6">
      <div className="card-learner">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h2 className="font-display text-[28px] font-semibold leading-9 text-forest">{isStudent ? `Hi ${s.firstName}!` : `${s.firstName} ${s.lastName}`}</h2>
            <p className="text-ink-soft">{s.group?.name ?? "No group yet"}</p>
            <div className="mt-2"><LeagueBadge level={lv.level} /></div>
          </div>
          <dl className="flex flex-wrap gap-8">
            <div><dt className="label">XP</dt><dd className="font-display text-3xl font-semibold text-forest">{s.xp}</dd></div>
            <div><dt className="label">Level</dt><dd className="font-display text-3xl font-semibold text-forest">{lv.level}</dd></div>
            {rate !== null && <div><dt className="label">Attendance</dt><dd className="font-display text-3xl font-semibold text-forest">{rate}%</dd></div>}
          </dl>
        </div>
        <div className="mt-5">
          <div className="h-3 rounded-full bg-mint" role="progressbar" aria-valuenow={lv.into} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to level ${lv.level + 1}`}>
            <div className="h-3 rounded-full bg-chess" style={{ width: `${Math.max(lv.into, 2)}%` }} />
          </div>
          <p className="muted mt-1">{100 - lv.into} XP to level {lv.level + 1}</p>
        </div>

        <div className="mt-6 rounded-learner bg-mint p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg font-semibold text-forest">Move Trail</div>
              <p className="text-sm text-ink">{trailDays === 0 ? "Every day is a fresh start." : `Daily puzzle on ${trailDays} of the last 7 days.`}</p>
            </div>
            <MoveTrail days={trail} />
          </div>
          {isStudent && daily && (
            daily.solves.length
              ? <p className="mt-3 text-sm font-semibold text-forest">✓ Today&apos;s puzzle is done. Well played!</p>
              : <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-ink">New day, new puzzle. Ready to play?</span><Link href="/portal/puzzle" className="btn btn-lg">Start puzzle</Link></div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-learner">
          <h3 className="h2 mb-3">Badges</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allBadges.map((b) => (
              <div key={b.id} className={`rounded-card border p-3 text-center ${owned.has(b.id) ? "border-go bg-[#FFF8D6]" : "border-dashed border-ink/25 bg-white"}`}>
                <div className={`text-2xl ${owned.has(b.id) ? "" : "opacity-40 grayscale"}`} aria-hidden>{b.icon}</div>
                <div className="text-sm font-semibold text-forest">{b.name}</div>
                <div className="text-xs text-ink-soft">{owned.has(b.id) ? "Earned" : b.description}</div>
              </div>
            ))}
          </div>
          {medals.length > 0 && (
            <>
              <h3 className="h2 mb-3 mt-6">Tournament medals</h3>
              <ul className="space-y-2">
                {medals.map((m) => (
                  <li key={m.name + m.date.toISOString()} className="flex items-center gap-3">
                    <Medal place={m.place} size={28} />
                    <div><div className="font-semibold text-forest">{m.name}</div><div className="muted">{m.place ? ["", "Gold", "Silver", "Bronze"][m.place] : "Participation"} · {fmtDate(m.date)}</div></div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="card-learner">
          <h3 className="h2 mb-1">{s.group?.name ?? "Group"} ranking</h3>
          <p className="muted mb-2">First names only.</p>
          <Leaderboard rows={board} highlightId={s.id} />
        </div>
      </div>
      {!isStudent && s.feeInvoices.length > 0 && (
        <div className="card">
          <h3 className="h2 mb-2">Club fees</h3>
          <ul className="text-[15px]">{s.feeInvoices.map((f) => (
            <li key={f.id} className="flex justify-between py-1.5">
              <span>Club fees are due on {fmtDate(f.dueDate)}.</span>
              <span className="flex items-center gap-2">{money(f.amountCts, currency)} <Pill v={f.dueDate < now ? "overdue" : "unpaid"} /></span>
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}

export default async function Portal() {
  const { user, club, children } = await portalContext();
  await ensureDefaultBadges(club.id);
  const isStudent = user.role === "student";
  return (
    <div>
      <PageHeader title={isStudent ? "Ready for your next move?" : "Your children"} sub={club.name} />
      {children.length === 0 ? <Empty>No student is linked to this account yet. Please contact the club.</Empty> : (
        <div className="space-y-10">{children.map((c) => <ChildCard key={c.id} id={c.id} isStudent={isStudent} currency={club.currency} />)}</div>
      )}
    </div>
  );
}
