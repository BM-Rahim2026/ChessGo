import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalContext } from "@/lib/portal";
import { checkSolution, solvePuzzle } from "@/lib/gamification";
import { ChessBoard } from "@/components/ChessBoard";
import { PageHeader, Empty } from "@/components/ui";
import { dayKey, str } from "@/lib/format";
import { displayStreak } from "@/lib/streak";

async function attempt(fd: FormData) {
  "use server";
  const { student } = await portalContext();
  if (!student) redirect("/portal");
  const p = await db.puzzle.findFirst({ where: { id: str(fd.get("id")), clubId: student.clubId } });
  if (!p) redirect("/portal/puzzle");
  if (!checkSolution(str(fd.get("move")), p.solution)) redirect(`/portal/puzzle?id=${p.id}&wrong=1`);
  const r = await solvePuzzle(student.id, p.id);
  redirect(`/portal/puzzle?id=${p.id}&gained=${r.gained}`);
}

export default async function PuzzlePage({ searchParams }: { searchParams: Promise<{ id?: string; wrong?: string; gained?: string }> }) {
  const { student } = await portalContext();
  if (!student) redirect("/portal");
  const sp = await searchParams;
  const today = dayKey();
  const daily = await db.puzzle.findFirst({ where: { clubId: student.clubId, dailyDate: today } });
  const puzzle = sp.id ? await db.puzzle.findFirst({ where: { id: sp.id, clubId: student.clubId, OR: [{ dailyDate: null }, { dailyDate: { lte: today } }] } }) : daily;
  const solved = puzzle ? await db.puzzleSolve.findUnique({ where: { puzzleId_studentId: { puzzleId: puzzle.id, studentId: student.id } } }) : null;
  const practice = await db.puzzle.findMany({
    where: { clubId: student.clubId, solves: { none: { studentId: student.id } }, OR: [{ dailyDate: null }, { dailyDate: { lt: today } }] }, orderBy: { rating: "asc" }, take: 8,
  });
  const me = await db.student.findUniqueOrThrow({ where: { id: student.id } });

  return (
    <div>
      <PageHeader title={puzzle?.id === daily?.id ? "Daily puzzle" : "Puzzle"} sub={`Current streak: ${displayStreak(me.lastPuzzleDay, today, me.streak)} 🔥 · best ${me.bestStreak}`} />
      {!puzzle ? <Empty>No daily puzzle today. Try a practice puzzle below!</Empty> : (
        <div className="card flex flex-wrap gap-6">
          <ChessBoard fen={puzzle.fen} size={320} />
          <div className="min-w-[14rem] flex-1 space-y-3">
            <h2 className="h2">{puzzle.title}</h2>
            <p className="muted">Rating {puzzle.rating}</p>
            {sp.gained && <p className="rounded bg-emerald-50 p-2 text-emerald-900">Correct! +{sp.gained} XP 🎉</p>}
            {solved ? <p className="text-emerald-700">✓ Solved. The answer was <code>{puzzle.solution}</code>.</p> : (
              <form action={attempt} className="space-y-2">
                <input type="hidden" name="id" value={puzzle.id} />
                {sp.wrong && <p className="rounded bg-red-50 p-2 text-sm text-red-800">Not quite. Try again!</p>}
                <label className="block"><span className="label">Your move (e.g. Qh7, Nf3, e4)</span><input className="input text-lg" name="move" autoComplete="off" required autoFocus /></label>
                <button className="btn">Check</button>
                {puzzle.hint && <details className="text-sm"><summary className="cursor-pointer text-brand">Need a hint?</summary>{puzzle.hint}</details>}
              </form>
            )}
          </div>
        </div>
      )}
      {practice.length > 0 && (
        <div className="card mt-6">
          <h2 className="h2 mb-2">Practice puzzles</h2>
          <ul className="grid gap-1 sm:grid-cols-2">{practice.map((p) => <li key={p.id}><a className="text-brand" href={`/portal/puzzle?id=${p.id}`}>{p.title}</a> <span className="muted">· {p.rating}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
