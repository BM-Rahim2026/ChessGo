import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { ChessBoard } from "@/components/ChessBoard";
import { str, optStr, dayKey } from "@/lib/format";
import { solvePuzzle } from "@/lib/gamification";

const FEN_RE = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}( [wb])?/;

async function createPuzzle(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const fen = str(fd.get("fen"));
  if (!FEN_RE.test(fen)) return;
  const dailyDate = optStr(fd.get("dailyDate"));
  if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate }, data: { dailyDate: null } });
  await db.puzzle.create({
    data: { clubId, title: str(fd.get("title")), fen, solution: str(fd.get("solution")), hint: optStr(fd.get("hint")), rating: Number(fd.get("rating")) || 1000, dailyDate },
  });
  revalidatePath("/admin/puzzles");
}

async function setDaily(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const id = str(fd.get("id"));
  const dailyDate = optStr(fd.get("dailyDate"));
  if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate, NOT: { id } }, data: { dailyDate: null } });
  await db.puzzle.updateMany({ where: { id, clubId }, data: { dailyDate } });
  revalidatePath("/admin/puzzles");
}

async function recordSolves(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const puzzle = await db.puzzle.findFirst({ where: { id: str(fd.get("id")), clubId } });
  if (!puzzle) return;
  const ids = fd.getAll("studentId").map(String);
  const students = await db.student.findMany({ where: { id: { in: ids }, clubId } });
  for (const s of students) await solvePuzzle(s.id, puzzle.id);
  revalidatePath("/admin/puzzles");
}

async function deletePuzzle(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  await db.puzzle.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/puzzles");
}

export default async function Puzzles() {
  const { clubId } = await requireStaff();
  const today = dayKey();
  const [puzzles, students] = await Promise.all([
    db.puzzle.findMany({ where: { clubId }, orderBy: [{ dailyDate: "desc" }, { createdAt: "desc" }], include: { _count: { select: { solves: true } } }, take: 50 }),
    db.student.findMany({ where: { clubId, status: "active" }, orderBy: [{ groupId: "asc" }, { firstName: "asc" }], include: { group: true } }),
  ]);
  const upcoming = puzzles.filter((p) => p.dailyDate && p.dailyDate >= today).sort((a, b) => a.dailyDate!.localeCompare(b.dailyDate!));
  return (
    <div>
      <PageHeader title="Puzzles" sub="Schedule one daily puzzle per day. Each solved daily puzzle adds a step to the student's Move Trail." />
      <div className="card mb-6">
        <h2 className="h2 mb-2">Daily schedule</h2>
        {upcoming.length === 0 ? <p className="muted">No daily puzzle scheduled from today. Students will see none.</p> : (
          <ul className="text-sm">{upcoming.map((p) => <li key={p.id}>{p.dailyDate === today ? <b>Today</b> : p.dailyDate} — {p.title}</li>)}</ul>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {puzzles.length === 0 && <Empty>No puzzles yet.</Empty>}
        {puzzles.map((p) => (
          <div key={p.id} className="card">
            <div className="flex gap-4">
              <ChessBoard fen={p.fen} size={176} />
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="font-semibold">{p.title}</div>
                <div className="muted">Rating {p.rating} · solved by {p._count.solves}</div>
                <div>Solution: <code>{p.solution}</code></div>
                <form action={setDaily} className="flex gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input className="input py-1" type="date" name="dailyDate" defaultValue={p.dailyDate ?? ""} />
                  <button className="btn-secondary btn-sm">Set daily</button>
                </form>
                <form action={deletePuzzle}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-red-600 underline">Delete</button></form>
              </div>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-brand">Record solved in class</summary>
              <form action={recordSolves} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
                  {students.map((s) => <label key={s.id} className="flex gap-2"><input type="checkbox" name="studentId" value={s.id} />{s.firstName} {s.lastName.charAt(0)}. <span className="muted">{s.group?.name}</span></label>)}
                </div>
                <button className="btn-secondary btn-sm mt-2">Save solves</button>
              </form>
            </details>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">New puzzle</h2>
        <form action={createPuzzle} className="grid-form">
          <Field label="Title"><input className="input" name="title" required placeholder="Mate in 1" /></Field>
          <Field label="Rating"><input className="input" name="rating" type="number" defaultValue={1000} /></Field>
          <Field label="FEN" className="sm:col-span-2"><input className="input font-mono" name="fen" required placeholder="6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1" /></Field>
          <Field label="Solution (first move is checked, e.g. Rd8#)"><input className="input" name="solution" required /></Field>
          <Field label="Hint"><input className="input" name="hint" /></Field>
          <Field label="Daily puzzle date (optional)"><input className="input" type="date" name="dailyDate" /></Field>
          <div className="flex items-end justify-end"><button className="btn">Add puzzle</button></div>
        </form>
      </div>
    </div>
  );
}
