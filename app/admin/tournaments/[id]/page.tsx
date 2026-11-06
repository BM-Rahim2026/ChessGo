import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill } from "@/components/ui";
import { fmtDate, str } from "@/lib/format";
import { recordGameXp, standings, setXp, evaluateBadges, XP } from "@/lib/gamification";

async function own(id: string, clubId: string) {
  const t = await db.tournament.findFirst({ where: { id, clubId }, include: { entries: { include: { student: true } }, games: true } });
  if (!t) throw new Error("Not found");
  return t;
}
const path = (id: string) => `/admin/tournaments/${id}`;

async function addEntries(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const groupId = str(fd.get("groupId"));
  const ids = groupId
    ? (await db.student.findMany({ where: { clubId, groupId, status: "active" }, select: { id: true } })).map((s) => s.id)
    : fd.getAll("studentId").map(String);
  const valid = await db.student.findMany({ where: { id: { in: ids }, clubId }, select: { id: true } });
  for (const s of valid) await db.tournamentEntry.upsert({ where: { tournamentId_studentId: { tournamentId: t.id, studentId: s.id } }, update: {}, create: { tournamentId: t.id, studentId: s.id } });
  revalidatePath(path(t.id));
}

async function removeEntry(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  await db.tournamentEntry.deleteMany({ where: { tournamentId: t.id, studentId: str(fd.get("studentId")) } });
  revalidatePath(path(t.id));
}

/** Pair the next round: sort by points, pair neighbours, avoid rematches where possible. Odd player gets a bye. */
async function autoPair(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const round = (Math.max(0, ...t.games.map((g) => g.round)) || 0) + 1;
  if (round > t.rounds) return;
  const table = standings(t.entries.map((e) => e.student), t.games);
  const played = new Set(t.games.map((g) => [g.whiteId, g.blackId].sort().join(":")));
  const pool = table.map((r) => r.id);
  const pairs: [string, string][] = [];
  while (pool.length > 1) {
    const a = pool.shift()!;
    let idx = pool.findIndex((b) => !played.has([a, b].sort().join(":")));
    if (idx === -1) idx = 0;
    const b = pool.splice(idx, 1)[0];
    pairs.push(round % 2 ? [a, b] : [b, a]);
  }
  for (const [w, b] of pairs) await db.tournamentGame.create({ data: { tournamentId: t.id, round, whiteId: w, blackId: b } });
  revalidatePath(path(t.id));
}

async function addGame(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const w = str(fd.get("whiteId")), b = str(fd.get("blackId"));
  const ids = new Set(t.entries.map((e) => e.studentId));
  if (w === b || !ids.has(w) || !ids.has(b)) return;
  await db.tournamentGame.create({ data: { tournamentId: t.id, round: Number(fd.get("round")) || 1, whiteId: w, blackId: b } });
  revalidatePath(path(t.id));
}

async function setResult(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const g = t.games.find((x) => x.id === str(fd.get("gameId")));
  if (!g) return;
  const r = str(fd.get("result"));
  const result = ["1-0", "0-1", "1/2-1/2"].includes(r) ? r : null;
  await db.tournamentGame.update({ where: { id: g.id }, data: { result } });
  await recordGameXp(clubId, g.id, g.whiteId, g.blackId, result);
  revalidatePath(path(t.id));
}

async function deleteGame(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const g = t.games.find((x) => x.id === str(fd.get("gameId")));
  if (!g) return;
  await recordGameXp(clubId, g.id, g.whiteId, g.blackId, null);
  await db.tournamentGame.delete({ where: { id: g.id } });
  revalidatePath(path(t.id));
}

async function finish(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await own(str(fd.get("id")), clubId);
  const table = standings(t.entries.map((e) => e.student), t.games);
  const winnerId = str(fd.get("winnerId")) || table[0]?.id;
  if (!winnerId) return;
  if (t.winnerId && t.winnerId !== winnerId) await setXp({ clubId, studentId: t.winnerId, sourceKey: `twin:${t.id}`, amount: 0, reason: "tournament_win" });
  await db.tournament.update({ where: { id: t.id }, data: { status: "finished", winnerId } });
  await setXp({ clubId, studentId: winnerId, sourceKey: `twin:${t.id}`, amount: XP.tournament_win, reason: "tournament_win", note: t.name });
  for (const e of t.entries) await evaluateBadges(e.studentId);
  revalidatePath(path(t.id));
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { clubId } = await requireStaff();
  const { id } = await params;
  const t = await db.tournament.findFirst({
    where: { id, clubId },
    include: { entries: { include: { student: true } }, games: { include: { white: true, black: true }, orderBy: [{ round: "asc" }] } },
  });
  if (!t) notFound();
  const [groups, students] = await Promise.all([
    db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    db.student.findMany({ where: { clubId, status: "active" }, orderBy: { firstName: "asc" } }),
  ]);
  const table = standings(t.entries.map((e) => e.student), t.games);
  const entered = new Set(t.entries.map((e) => e.studentId));
  const players = t.entries.map((e) => e.student).sort((a, b) => a.firstName.localeCompare(b.firstName));
  const nextRound = (Math.max(0, ...t.games.map((g) => g.round)) || 0) + 1;

  return (
    <div>
      <PageHeader title={t.name} sub={`${fmtDate(t.date)} · ${t.rounds} rounds`}><Pill v={t.status} /></PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div className="card">
            <h2 className="h2 mb-2">Standings</h2>
            <table className="table">
              <thead><tr><th>#</th><th>Player</th><th className="text-right">Pts</th><th className="text-right">Games</th><th></th></tr></thead>
              <tbody>{table.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{t.winnerId === r.id ? "🏆 " : ""}{r.firstName} {r.lastName}</td>
                  <td className="text-right tabular-nums">{r.points}</td><td className="text-right">{r.played}</td>
                  <td className="text-right"><form action={removeEntry}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="studentId" value={r.id} /><button className="text-xs text-red-600" title="Remove player">×</button></form></td>
                </tr>
              ))}</tbody>
            </table>
            <form action={finish} className="mt-4 flex gap-2">
              <input type="hidden" name="id" value={t.id} />
              <select className="input" name="winnerId" defaultValue={t.winnerId ?? table[0]?.id}>{table.map((r) => <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>)}</select>
              <button className="btn whitespace-nowrap">{t.status === "finished" ? "Update winner" : "Finish & crown winner"}</button>
            </form>
          </div>
          <div className="card">
            <h2 className="h2 mb-2">Add players</h2>
            <form action={addEntries} className="flex gap-2">
              <input type="hidden" name="id" value={t.id} />
              <select className="input" name="groupId">{groups.map((g) => <option key={g.id} value={g.id}>Whole group: {g.name}</option>)}</select>
              <button className="btn-secondary">Add</button>
            </form>
            <form action={addEntries} className="mt-3">
              <input type="hidden" name="id" value={t.id} />
              <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
                {students.filter((s) => !entered.has(s.id)).map((s) => <label key={s.id} className="flex gap-2"><input type="checkbox" name="studentId" value={s.id} />{s.firstName} {s.lastName}</label>)}
              </div>
              <button className="btn-secondary btn-sm mt-2">Add selected</button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h2">Games</h2>
            {nextRound <= t.rounds && players.length > 1 && (
              <form action={autoPair}><input type="hidden" name="id" value={t.id} /><button className="btn-secondary btn-sm">Auto-pair round {nextRound}</button></form>
            )}
          </div>
          <table className="table">
            <thead><tr><th>Rd</th><th>White</th><th>Black</th><th>Result</th><th></th></tr></thead>
            <tbody>{t.games.map((g) => (
              <tr key={g.id}>
                <td>{g.round}</td><td>{g.white.firstName} {g.white.lastName.charAt(0)}.</td><td>{g.black.firstName} {g.black.lastName.charAt(0)}.</td>
                <td>
                  <form action={setResult} className="flex gap-1">
                    <input type="hidden" name="id" value={t.id} /><input type="hidden" name="gameId" value={g.id} />
                    <select className="input py-1" name="result" defaultValue={g.result ?? ""}>
                      <option value="">—</option><option value="1-0">1-0</option><option value="1/2-1/2">½-½</option><option value="0-1">0-1</option>
                    </select>
                    <button className="btn-secondary btn-sm">Save</button>
                  </form>
                </td>
                <td><form action={deleteGame}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="gameId" value={g.id} /><button className="text-xs text-red-600">×</button></form></td>
              </tr>
            ))}</tbody>
          </table>
          {players.length > 1 && (
            <form action={addGame} className="mt-4 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={t.id} />
              <Field label="Round"><input className="input w-16" type="number" name="round" defaultValue={Math.min(nextRound, t.rounds)} min={1} max={t.rounds} /></Field>
              <Field label="White"><select className="input" name="whiteId">{players.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></Field>
              <Field label="Black"><select className="input" name="blackId" defaultValue={players[1]?.id}>{players.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></Field>
              <button className="btn-secondary">Add game</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
