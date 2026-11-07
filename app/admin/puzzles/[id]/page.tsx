import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PuzzleBoard } from "@/components/PuzzleBoard";
import { testPuzzleMove, puzzleSolutionForStaff } from "@/app/actions/puzzle";
import { parseSolution } from "@/lib/puzzleplay";
import { puzzleLabels } from "@/lib/puzzleLabels";
import { getLocale } from "@/lib/i18n/server";
import { makeT, sanToLocale } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export default async function TestPuzzle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { clubId } = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.puzzle.findFirst({ where: { id, clubId }, include: { _count: { select: { solves: true } } } });
  if (!p) notFound();
  const locale = await getLocale();
  const t = makeT(locale);
  const line = parseSolution(p.fen, p.solution);
  const studentMoves = Math.ceil(line.length / 2);
  const notation = line.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : "") + sanToLocale(m, locale)).join(" ");

  return (
    <div>
      <PageHeader title={p.title} sub={t("Test the puzzle exactly as students will see it.")}>
        <Link href="/admin/puzzles" className="btn-secondary">← {t("All puzzles")}</Link>
      </PageHeader>
      {sp.new && <div className="card mb-4 text-sm text-forest">{t("Puzzle created. Try solving it below.")}</div>}
      {line.length === 0 && <div className="card mb-4 text-sm text-red-800">{t("This puzzle's solution is not valid for the position, so students cannot solve it. Delete it and create it again.")}</div>}
      <div className="card-learner flex flex-wrap gap-6">
        <PuzzleBoard puzzleId={p.id} fen={p.fen} hint={p.hint} size={440} check={testPuzzleMove} solution={puzzleSolutionForStaff.bind(null, p.id)} labels={puzzleLabels(t)} />
        <div className="min-w-[14rem] flex-1 space-y-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="muted">{t("Rating")}</dt><dd>{p.rating}</dd>
            <dt className="muted">{t("Daily puzzle")}</dt><dd>{p.dailyDate ?? "—"}</dd>
            <dt className="muted">{t("Moves to find")}</dt><dd>{studentMoves}</dd>
            <dt className="muted">{t("Solved by")}</dt><dd>{p._count.solves}</dd>
          </dl>
          <details>
            <summary className="cursor-pointer font-semibold text-forest underline">{t("Show the solution line")}</summary>
            <p className="mt-1 font-mono">{notation || "—"}</p>
          </details>
          <details>
            <summary className="cursor-pointer text-ink-soft underline">FEN</summary>
            <p className="mt-1 break-all font-mono text-xs">{p.fen}</p>
          </details>
          <p className="muted">{t("A move that gives checkmate is always accepted, even if it is not the stored solution.")}</p>
        </div>
      </div>
    </div>
  );
}
