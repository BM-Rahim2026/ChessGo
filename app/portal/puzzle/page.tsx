import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalContext } from "@/lib/portal";
import { PuzzleBoard } from "@/components/PuzzleBoard";
import { studentPuzzleMove } from "@/app/actions/puzzle";
import { puzzleLabels } from "@/lib/puzzleLabels";
import { PageHeader, Empty } from "@/components/ui";
import { dayKey } from "@/lib/format";
import { moveTrail } from "@/lib/gamification";
import { MoveTrail } from "@/components/Brand";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export default async function PuzzlePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
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
      <PageHeader title={puzzle?.id === daily?.id ? t("New day, new puzzle.") : t("Practice puzzle")} sub={t("Find the best move and play it on the board.")}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-mint px-3 py-2"><span className="text-sm font-semibold text-forest">{t("Move Trail")}</span><MoveTrail days={trail} size={18} /></div>
      </PageHeader>
      {!puzzle ? <Empty>{t("No daily puzzle today. Try a practice puzzle below!")}</Empty> : (
        <div className="card-learner flex flex-wrap gap-6">
          <PuzzleBoard key={puzzle.id} puzzleId={puzzle.id} fen={puzzle.fen} hint={puzzle.hint} size={400}
            check={studentPuzzleMove} labels={puzzleLabels(t)} solvedAlready={Boolean(solved)} />
          <div className="min-w-[12rem] flex-1 space-y-2">
            <h2 className="h2">{puzzle.title}</h2>
            <p className="muted">{t("Rating")} {puzzle.rating}</p>
            <p className="text-sm text-ink">{t("Click a piece, then the square you want to move it to. You can also drag pieces.")}</p>
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
