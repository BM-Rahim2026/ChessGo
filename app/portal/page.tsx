import Link from "next/link";
import { db } from "@/lib/db";
import { portalContext, level } from "@/lib/portal";
import { groupLeaderboard, evaluateBadges } from "@/lib/gamification";
import { displayStreak } from "@/lib/streak";
import { PageHeader, Pill, Empty } from "@/components/ui";
import { Leaderboard } from "@/components/Leaderboard";
import { dayKey, money, fmtDate } from "@/lib/format";

async function ChildCard({ id, isStudent, currency }: { id: string; isStudent: boolean; currency: string }) {
  await evaluateBadges(id);
  const s = await db.student.findUniqueOrThrow({
    where: { id },
    include: { group: true, badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } }, feeInvoices: { where: { paidAt: null }, orderBy: { period: "asc" } } },
  });
  const [att, board, allBadges, daily] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], where: { studentId: id }, _count: true }),
    s.groupId ? groupLeaderboard(s.groupId) : Promise.resolve([]),
    db.badge.findMany({ where: { clubId: s.clubId }, orderBy: { threshold: "asc" } }),
    db.puzzle.findFirst({ where: { clubId: s.clubId, dailyDate: dayKey() }, include: { solves: { where: { studentId: id } } } }),
  ]);
  const a = Object.fromEntries(att.map((r) => [r.status, r._count]));
  const marked = att.reduce((x, r) => x + r._count, 0);
  const rate = marked ? Math.round((((a.present ?? 0) + (a.late ?? 0)) / marked) * 100) : null;
  const lv = level(s.xp);
  const streak = displayStreak(s.lastPuzzleDay, dayKey(), s.streak);
  const owned = new Set(s.badges.map((b) => b.badgeId));
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{isStudent ? `Hi ${s.firstName}!` : `${s.firstName} ${s.lastName}`}</h2>
            <p className="muted">{s.group?.name ?? "No group"}</p>
          </div>
          <div className="flex gap-6 text-center">
            <div><div className="text-3xl font-bold text-brand">{s.xp}</div><div className="label">XP</div></div>
            <div><div className="text-3xl font-bold">{lv.level}</div><div className="label">Level</div></div>
            <div><div className="text-3xl font-bold">{streak}🔥</div><div className="label">Streak</div></div>
            {rate !== null && <div><div className="text-3xl font-bold">{rate}%</div><div className="label">Attendance</div></div>}
          </div>
        </div>
        <div className="mt-4 h-2 rounded bg-stone-100"><div className="h-2 rounded bg-brand" style={{ width: `${lv.into}%` }} /></div>
        <p className="muted mt-1">{100 - lv.into} XP to level {lv.level + 1}</p>
        {isStudent && daily && (
          daily.solves.length ? <p className="mt-3 text-sm text-emerald-700">✓ Today&apos;s puzzle solved. Come back tomorrow to keep your streak!</p>
            : <Link href="/portal/puzzle" className="btn mt-3">Solve today&apos;s puzzle 🧩</Link>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="h2 mb-3">Badges</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {allBadges.map((b) => (
              <div key={b.id} title={b.description} className={`rounded-lg border p-2 text-center ${owned.has(b.id) ? "border-amber-300 bg-amber-50" : "border-stone-200 opacity-40 grayscale"}`}>
                <div className="text-2xl">{b.icon}</div>
                <div className="text-xs font-medium">{b.name}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 className="h2 mb-1">{s.group?.name ?? "Group"} leaderboard</h3>
          <p className="muted mb-2">First names only.</p>
          <Leaderboard rows={board} highlightId={s.id} />
        </div>
      </div>
      {!isStudent && s.feeInvoices.length > 0 && (
        <div className="card">
          <h3 className="h2 mb-2">Open tuition</h3>
          <ul className="text-sm">{s.feeInvoices.map((f) => <li key={f.id} className="flex justify-between py-1"><span>{f.period} · due {fmtDate(f.dueDate)}</span><span className="flex gap-2">{money(f.amountCts, currency)} <Pill v={f.dueDate < now ? "overdue" : "unpaid"} /></span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default async function Portal() {
  const { user, club, children } = await portalContext();
  const isStudent = user.role === "student";
  return (
    <div>
      <PageHeader title={isStudent ? "My progress" : "My children"} sub={club.name} />
      {children.length === 0 ? <Empty>No student is linked to this account yet. Please contact the club.</Empty> : (
        <div className="space-y-10">{children.map((c) => <ChildCard key={c.id} id={c.id} isStudent={isStudent} currency={club.currency} />)}</div>
      )}
    </div>
  );
}
