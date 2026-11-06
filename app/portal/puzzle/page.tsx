import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalContext } from "@/lib/portal";
import { checkSolution, solvePuzzle } from "@/lib/gamification";
import { ChessBoard } from "@/components/ChessBoard";
import { PageHeader, Empty } from "@/components/ui";
import { dayKey, str } from "@/lib/format";
import { moveTrail } from "@/lib/gamification";
import { MoveTrail, Feedback } from "@/components/Brand";
import { getLocale } from "@/lib/i18n/server";
import { makeT, sanToLocale } from "@/lib/i18n/core";

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
  const trail = await moveTrail(student.id, 7, today);
  const locale = await getLocale();
  const t = makeT(locale);

  return (
    <div>
      <PageHeader title={puzzle?.id === daily?.id ? t("New day, new puzzle.") : t("Practice puzzle")} sub={t("Find the best first move.")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-mint px-3 py-2"><span className="text-sm font-semibold text-forest">{t("Move Trail")}</span><MoveTrail days={trail} size={18} /></div>
      </PageHeader>
      {!puzzle ? <Empty>{t("No daily puzzle today. Try a practice puzzle below!")}</Empty> : (
        <div className="card-learner flex flex-wrap gap-6">
          <ChessBoard fen={puzzle.fen} size={320} />
          <div className="min-w-[14rem] flex-1 space-y-3">
            <h2 className="h2">{puzzle.title}</h2>
            <p className="muted">{t("Rating")} {puzzle.rating}</p>
            {sp.gained && <Feedback title={t("Well spotted!")}>{t("That was the best move.")} +{sp.gained} XP</Feedback>}
            {solved ? <p className="text-ink">✓ {t("Solved. The move was")} <strong className="text-forest">{sanToLocale(puzzle.solution.split(" ")[0], locale)}</strong>.</p> : (
              <form action={attempt} className="space-y-2">
                <input type="hidden" name="id" value={puzzle.id} />
                {sp.wrong && <Feedback kind="try" title={t("Almost!")}>{t("Look again: which piece can make the strongest move?")}</Feedback>}
                <label className="block"><span className="label">{t("Your move (e.g. Qh7, Nf3, e4)")}</span><input className="input min-h-[48px] text-lg" name="move" autoComplete="off" required autoFocus /></label>
                <button className="btn btn-lg">{sp.wrong ? t("Try again") : t("Check my move")}</button>
                {puzzle.hint && <details className="text-sm"><summary className="cursor-pointer font-semibold text-forest underline">{t("Need a hint?")}</summary>{puzzle.hint}</details>}
              </form>
            )}
          </div>
        </div>
      )}
      {practice.length > 0 && (
        <div className="card-learner mt-6">
          <h2 className="h2 mb-2">{t("Practice puzzles")}</h2>
          <ul className="grid gap-1 sm:grid-cols-2">{practice.map((p) => <li key={p.id}><a className="font-semibold text-forest underline" href={`/portal/puzzle?id=${p.id}`}>{p.title}</a> <span className="muted">· {p.rating}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
