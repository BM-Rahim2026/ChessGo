import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Tabs } from "@/components/ui";
import { Leaderboard } from "@/components/Leaderboard";
import { groupLeaderboard, ensureDefaultBadges, setXp, XP, evaluateBadges } from "@/lib/gamification";
import { STREAK_BONUS_EVERY, STREAK_BONUS_XP } from "@/lib/streak";
import { str, optStr } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

async function bulkBonus(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId, user } = await requireStaff();
  const amount = Math.trunc(Number(fd.get("amount")));
  if (!amount || Math.abs(amount) > 500) return;
  const ids = fd.getAll("studentId").map(String);
  const students = await db.student.findMany({ where: { id: { in: ids }, clubId } });
  for (const s of students) await setXp({ clubId, studentId: s.id, sourceKey: null, amount, reason: "bonus", note: optStr(fd.get("note")), awardedById: user.id });
  revalidatePath("/admin/gamification");
}

async function saveBadge(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const metric = optStr(fd.get("metric"));
  const threshold = metric ? Math.max(1, Number(fd.get("threshold")) || 1) : null;
  const name = str(fd.get("name"));
  const code = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) + "_" + Date.now().toString(36);
  await db.badge.create({ data: { clubId, code, name, description: str(fd.get("description")), icon: str(fd.get("icon")) || "🏅", metric, threshold } });
  if (metric) for (const s of await db.student.findMany({ where: { clubId }, select: { id: true } })) await evaluateBadges(s.id);
  revalidatePath("/admin/gamification");
}

async function deleteBadge(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  await db.badge.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/gamification");
}

export default async function Gamification({ searchParams }: { searchParams: Promise<{ group?: string; period?: string }> }) {
  const t = await getT();
  const { clubId, user } = await requireStaff();
  await ensureDefaultBadges(clubId);
  const sp = await searchParams;
  const groups = await db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } });
  const groupId = sp.group ?? groups[0]?.id;
  const period = sp.period === "month" ? "month" : "all";
  const [board, badges, students] = await Promise.all([
    groupId ? groupLeaderboard(groupId, period) : Promise.resolve([]),
    db.badge.findMany({ where: { clubId }, include: { _count: { select: { awards: true } } }, orderBy: [{ metric: "asc" }, { threshold: "asc" }] }),
    groupId ? db.student.findMany({ where: { groupId, clubId, status: "active" }, orderBy: { firstName: "asc" } }) : Promise.resolve([]),
  ]);
  const isAdmin = user.role === "club_admin";

  return (
    <div>
      <PageHeader title={t("XP & badges")} sub={t("Students earn XP automatically; coaches can add bonus XP.")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h2">{t("Group leaderboard")}</h2>
            <form className="flex gap-2">
              <select className="input py-1" name="group" defaultValue={groupId}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <input type="hidden" name="period" value={period} />
              <button className="btn-secondary btn-sm">{t("Show")}</button>
            </form>
          </div>
          <Tabs active={period} items={[
            { key: "all", label: t("All time"), href: `/admin/gamification?group=${groupId}&period=all` },
            { key: "month", label: t("This month"), href: `/admin/gamification?group=${groupId}&period=month` },
          ]} />
          <Leaderboard rows={board} />
          <p className="muted mt-3">{t("Students and parents see this ranking with first names only. Rewards are for learning and taking part, never for purchases.")}</p>
        </div>

        <div className="card">
          <h2 className="h2 mb-3">{t("Bonus XP for several students")}</h2>
          <form action={bulkBonus} className="space-y-3">
            <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded border border-ink/15 p-2 text-sm">
              {students.map((s) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="studentId" value={s.id} /> {s.firstName} {s.lastName}</label>)}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label={t("XP")}><input className="input w-24" type="number" name="amount" defaultValue={10} min={-500} max={500} /></Field>
              <Field label={t("Reason")} className="flex-1"><input className="input" name="note" placeholder={t("Homework done")} /></Field>
              <button className="btn">{t("Award")}</button>
            </div>
          </form>
          <h3 className="label mt-6">{t("How XP is earned")}</h3>
          <ul className="text-sm text-ink">
            <li>{t("Attendance: +{a} present, +{b} late", { a: XP.attendance_present, b: XP.attendance_late })}</li>
            <li>{t("Puzzle solved: +{a}; daily puzzle: +{b}", { a: XP.puzzle, b: XP.daily_puzzle })}</li>
            <li>{t("Every {n} days in a row on the Move Trail: +{xp}", { n: STREAK_BONUS_EVERY, xp: STREAK_BONUS_XP })}</li>
            <li>{t("Tournament game: +{a} (+{b} win, +{c} draw)", { a: XP.tournament_game, b: XP.tournament_game_win, c: XP.tournament_game_draw })}</li>
            <li>{t("Tournament winner: +{a}", { a: XP.tournament_win })}</li>
          </ul>
        </div>
      </div>

      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("Badges")}</h2>
        <table className="table">
          <thead><tr><th></th><th>{t("Badge")}</th><th>{t("Rule")}</th><th className="text-right">{t("Awarded")}</th><th></th></tr></thead>
          <tbody>
            {badges.map((b) => (
              <tr key={b.id}>
                <td className="text-xl">{b.icon}</td>
                <td><div className="font-medium">{t(b.name)}</div><div className="muted">{t(b.description)}</div></td>
                <td className="text-ink-soft">{b.metric ? `${t(`metric:${b.metric}`)} ≥ ${b.threshold}` : t("manual")}</td>
                <td className="text-right tabular-nums">{b._count.awards}</td>
                <td className="text-right">{isAdmin && b.code.startsWith("custom_") && <form action={deleteBadge}><input type="hidden" name="id" value={b.id} /><button className="btn-danger btn-sm">{t("Delete")}</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <form action={saveBadge} className="mt-5 grid gap-2 sm:grid-cols-6">
            <input className="input" name="icon" placeholder="🏅" maxLength={4} />
            <input className="input sm:col-span-2" name="name" placeholder={t("Badge name")} required />
            <input className="input sm:col-span-3" name="description" placeholder={t("Description")} required />
            <select className="input sm:col-span-2" name="metric" defaultValue="">
              <option value="">{t("Manual (coach awards)")}</option>
              <option value="sessions">{t("Sessions attended")}</option><option value="puzzles">{t("Puzzles solved")}</option>
              <option value="tournaments">{t("Tournaments played")}</option><option value="tournament_wins">{t("Tournaments won")}</option>
              <option value="best_streak">{t("Longest Move Trail (days in a row)")}</option><option value="xp">{t("Total XP")}</option>
            </select>
            <input className="input" name="threshold" type="number" min={1} placeholder="≥" />
            <button className="btn sm:col-span-3">{t("Add badge")}</button>
          </form>
        )}
      </div>
    </div>
  );
}
