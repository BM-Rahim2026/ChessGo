import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chess } from "chess.js";
import { Field } from "@/components/ui";
import { str, optStr } from "@/lib/format";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { PuzzleBoard } from "@/components/PuzzleBoard";
import { testPuzzleMove, puzzleSolutionForStaff } from "@/app/actions/puzzle";
import { parseSolution, puzzleLines, strictAlternatives, strictSolution } from "@/lib/puzzleplay";
import { puzzleLabels } from "@/lib/puzzleLabels";
import { getLocale } from "@/lib/i18n/server";
import { makeT, sanToLocale } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

/** Save changes to a puzzle. FEN and every solution move are checked, like when creating. */
async function savePuzzle(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const id = str(fd.get("id"));
  const p = await db.puzzle.findFirst({ where: { id, clubId } });
  if (!p) redirect("/admin/puzzles");
  let fen = str(fd.get("fen"));
  try { fen = new Chess(fen).fen(); } catch { redirect(`/admin/puzzles/${id}?err=fen`); }
  const raw = str(fd.get("solution"));
  const line = strictSolution(fen, raw);
  if (!line) redirect(`/admin/puzzles/${id}?err=solution`);
  const alts = strictAlternatives(fen, str(fd.get("altSolutions")), line);
  if (!alts.ok) redirect(`/admin/puzzles/${id}?err=alt&line=${alts.line}`);
  const title = str(fd.get("title")).slice(0, 120);
  if (!title) redirect(`/admin/puzzles/${id}?err=title`);
  const dailyDate = optStr(fd.get("dailyDate"));
  if (dailyDate && !/^\d{4}-\d{2}-\d{2}$/.test(dailyDate)) redirect(`/admin/puzzles/${id}?err=date`);
  if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate, NOT: { id } }, data: { dailyDate: null } });
  const rating = Math.min(3000, Math.max(100, Math.round(Number(fd.get("rating")) || p.rating)));
  await db.puzzle.update({
    where: { id },
    data: { title, fen, solution: line.join(" "), altSolutions: alts.value, hint: optStr(fd.get("hint"))?.slice(0, 300) ?? null, rating, dailyDate },
  });
  redirect(`/admin/puzzles/${id}?saved=1`);
}

export default async function TestPuzzle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; saved?: string; err?: string; edit?: string; line?: string }> }) {
  const { clubId } = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const p = await db.puzzle.findFirst({ where: { id, clubId }, include: { _count: { select: { solves: true } } } });
  if (!p) notFound();
  const locale = await getLocale();
  const t = makeT(locale);
  const line = parseSolution(p.fen, p.solution);
  const studentMoves = Math.ceil(line.length / 2);
  const fmtLine = (l: string[]) => l.map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : "") + sanToLocale(m, locale)).join(" ");
  const notation = fmtLine(line);
  const altLines = puzzleLines(p.fen, p.solution, p.altSolutions).slice(1);

  return (
    <div>
      <PageHeader title={p.title} sub={t("Test the puzzle exactly as students will see it.")}>
        <a href="#edit" className="btn">✎ {t("Edit puzzle")}</a>
        <Link href="/admin/puzzles" className="btn-secondary">← {t("All puzzles")}</Link>
      </PageHeader>
      {sp.new && <div className="card mb-4 text-sm text-forest">{t("Puzzle created. Try solving it below.")}</div>}
      {sp.saved && <div className="card mb-4 text-sm text-forest">{t("Changes saved. Test the puzzle again below.")}</div>}
      {sp.err && <div className="card mb-4 text-sm text-red-800">{
        sp.err === "fen" ? t("The FEN is not a valid chess position.")
        : sp.err === "solution" ? t("The solution contains an illegal move. Use moves like Rd8# or Qh5 Nf6 Qxf7#.")
        : sp.err === "alt" ? t("Alternative solution no. {n} contains an illegal move or a false # / +.", { n: sp.line ?? "?" })
        : sp.err === "title" ? t("Enter a title.") : t("Wrong date.")}{" "}{t("Nothing was changed.")}</div>}
      {line.length === 0 && <div className="card mb-4 text-sm text-red-800">{t("This puzzle's solution is not valid for the position, so students cannot solve it. Delete it and create it again.")}</div>}
      <div className="card-learner flex flex-wrap gap-6">
        <PuzzleBoard key={`${p.fen}|${p.solution}|${p.altSolutions}`} puzzleId={p.id} fen={p.fen} hint={p.hint} size={440} check={testPuzzleMove} solution={puzzleSolutionForStaff.bind(null, p.id)} labels={puzzleLabels(t)} />
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
            {altLines.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-forest">{t("Also accepted")}:</p>
                <ul className="mt-1 space-y-0.5 font-mono">{altLines.map((l, i) => <li key={i}>{fmtLine(l)}</li>)}</ul>
              </>
            )}
          </details>
          <details>
            <summary className="cursor-pointer text-ink-soft underline">FEN</summary>
            <p className="mt-1 break-all font-mono text-xs">{p.fen}</p>
          </details>
          <p className="muted">{t("A move that gives checkmate is always accepted, even if it is not the stored solution.")} {t("Other correct moves can be added below as alternative solutions.")}</p>
        </div>
      </div>
      <div id="edit" className="card mt-6 scroll-mt-6">
        <h2 className="h2 mb-1">{t("Edit puzzle")}</h2>
        <p className="muted mb-3 text-sm">{t("Write the whole line, including the opponent's replies, in Polish or English notation (e.g. Wd8# or Hh5 Sf6 Hxf7#). Moves are checked before saving.")}</p>
        {p._count.solves > 0 && <p className="mb-3 rounded-control bg-mint px-3 py-2 text-sm">{t("{n} students already solved this puzzle — they keep their XP if you change it.", { n: p._count.solves })}</p>}
        <form key={`${p.title}|${p.fen}|${p.solution}|${p.altSolutions}|${p.hint}|${p.rating}|${p.dailyDate}`} action={savePuzzle} className="grid-form">
          <input type="hidden" name="id" value={p.id} />
          <Field label={t("Title")}><input className="input" name="title" required maxLength={120} defaultValue={p.title} /></Field>
          <Field label={t("Rating")}><input className="input" name="rating" type="number" min={100} max={3000} defaultValue={p.rating} /></Field>
          <Field label="FEN" className="sm:col-span-2"><input className="input font-mono" name="fen" required defaultValue={p.fen} /></Field>
          <Field label={t("Solution (all moves, e.g. Rd8# or Qh5 Nf6 Qxf7#)")}><input className="input" name="solution" required defaultValue={line.map((m) => sanToLocale(m, locale)).join(" ") || p.solution} /></Field>
          <Field label={t("Other correct solutions (optional) — one per line")} className="sm:col-span-2">
            <textarea className="input font-mono" name="altSolutions" rows={3} defaultValue={altLines.map((l) => l.map((m) => sanToLocale(m, locale)).join(" ")).join("\n")} placeholder={t("e.g.\nHh5+ Kg8 Hh7#\nWe8+")} />
          </Field>
          <Field label={t("Hint")}><input className="input" name="hint" maxLength={300} defaultValue={p.hint ?? ""} /></Field>
          <Field label={t("Daily puzzle date (optional)")}><input className="input" type="date" name="dailyDate" defaultValue={p.dailyDate ?? ""} /></Field>
          <div className="flex items-end justify-end"><button className="btn">{t("Save changes")}</button></div>
        </form>
      </div>
    </div>
  );
}
