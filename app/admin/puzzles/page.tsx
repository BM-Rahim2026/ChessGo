import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Chess } from "chess.js";
import { strictAlternatives, strictSolution } from "@/lib/puzzleplay";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { ChessBoard } from "@/components/ChessBoard";
import { str, optStr, dayKey } from "@/lib/format";
import { solvePuzzle } from "@/lib/gamification";
import { getT } from "@/lib/i18n/server";

const FEN_RE = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}( [wb])?/;

async function createPuzzle(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff();
  let fen = str(fd.get("fen"));
  if (!FEN_RE.test(fen)) redirect("/admin/puzzles?err=fen");
  try { fen = new Chess(fen).fen(); } catch { redirect("/admin/puzzles?err=fen"); }
  const rawSolution = str(fd.get("solution"));
  // Every move must be legal (and real mates/checks where marked): a typo would make the puzzle unsolvable.
  const line = strictSolution(fen, rawSolution);
  if (!line) redirect("/admin/puzzles?err=solution");
  const alts = strictAlternatives(fen, str(fd.get("altSolutions")), line);
  if (!alts.ok) redirect(`/admin/puzzles?err=alt&line=${alts.line}`);
  const dailyDate = optStr(fd.get("dailyDate"));
  if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate }, data: { dailyDate: null } });
  const p = await db.puzzle.create({
    data: { clubId, title: str(fd.get("title")), fen, solution: line.join(" "), altSolutions: alts.value, hint: optStr(fd.get("hint")), rating: Number(fd.get("rating")) || 1000, dailyDate },
  });
  redirect(`/admin/puzzles/${p.id}?new=1`);
}

async function setDaily(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff();
  const id = str(fd.get("id"));
  const dailyDate = optStr(fd.get("dailyDate"));
  if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate, NOT: { id } }, data: { dailyDate: null } });
  await db.puzzle.updateMany({ where: { id, clubId }, data: { dailyDate } });
  revalidatePath("/admin/puzzles");
}

async function recordSolves(fd: FormData) {
  "use server";
  const t = await getT();
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
  const t = await getT();
  const { clubId } = await requireStaff();
  await db.puzzle.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/puzzles");
}

const PAGE_SIZE = 24;

export default async function Puzzles({ searchParams }: { searchParams: Promise<{ err?: string; q?: string; show?: string; page?: string; line?: string }> }) {
  const t = await getT();
  const sp = await searchParams;
  const { err } = sp;
  const { clubId } = await requireStaff();
  const today = dayKey();
  const q = sp.q?.trim() ?? "";
  const show = ["scheduled", "unscheduled", "unsolved", "past"].includes(sp.show ?? "") ? sp.show! : "all";
  // All puzzles are kept; the list is split into pages and can be searched and filtered.
  const where: Prisma.PuzzleWhereInput = {
    clubId,
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { hint: { contains: q, mode: "insensitive" } }] } : {}),
    ...(show === "scheduled" ? { dailyDate: { gte: today } } : show === "past" ? { dailyDate: { lt: today } } : show === "unscheduled" ? { dailyDate: null } : show === "unsolved" ? { solves: { none: {} } } : {}),
  };
  const [total, allCount] = await Promise.all([db.puzzle.count({ where }), db.puzzle.count({ where: { clubId } })]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const [puzzles, students, upcoming] = await Promise.all([
    db.puzzle.findMany({
      where, include: { _count: { select: { solves: true } } }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      orderBy: show === "scheduled" ? [{ dailyDate: "asc" }] : show === "past" ? [{ dailyDate: "desc" }] : [{ createdAt: "desc" }],
    }),
    db.student.findMany({ where: { clubId, status: "active" }, orderBy: [{ groupId: "asc" }, { firstName: "asc" }], include: { group: true } }),
    db.puzzle.findMany({ where: { clubId, dailyDate: { gte: today } }, orderBy: { dailyDate: "asc" }, take: 60, select: { id: true, title: true, dailyDate: true } }),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    const all = { q: q || undefined, show: show !== "all" ? show : undefined, page: undefined as number | undefined, ...o };
    for (const [k, v] of Object.entries(all)) if (v !== undefined && v !== "") u.set(k, String(v));
    const str = u.toString();
    return `/admin/puzzles${str ? `?${str}` : ""}`;
  };
  const Pager = () => pages > 1 ? (
    <nav className="my-4 flex flex-wrap items-center gap-1" aria-label={t("Pages")}>
      <a href={qs({ page: Math.max(1, page - 1) })} aria-disabled={page === 1} className={`btn-secondary btn-sm ${page === 1 ? "pointer-events-none opacity-40" : ""}`}>← {t("Previous")}</a>
      {Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2).map((n, i, arr) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-ink-soft">…</span>}
          <a href={qs({ page: n })} aria-current={n === page ? "page" : undefined} className={`flex h-9 min-w-9 items-center justify-center rounded-control border px-2 text-sm font-semibold ${n === page ? "border-forest bg-forest text-white" : "border-ink/15 bg-white text-forest hover:bg-mint"}`}>{n}</a>
        </span>
      ))}
      <a href={qs({ page: Math.min(pages, page + 1) })} aria-disabled={page === pages} className={`btn-secondary btn-sm ${page === pages ? "pointer-events-none opacity-40" : ""}`}>{t("Next")} →</a>
    </nav>
  ) : null;
  return (
    <div>
      <PageHeader title={t("Puzzles")} sub={t("Schedule one daily puzzle per day. Each solved daily puzzle adds a step to the student's Move Trail.")} />
      {err && <div className="card mb-4 text-sm text-red-800">{err === "fen" ? t("The FEN is not a valid chess position.") : err === "alt" ? t("Alternative solution no. {n} contains an illegal move or a false # / +.", { n: sp.line ?? "?" }) : t("The solution contains an illegal move. Use moves like Rd8# or Qh5 Nf6 Qxf7#.")}</div>}
      <div className="card mb-6">
        <h2 className="h2 mb-2">{t("Daily schedule")}</h2>
        {upcoming.length === 0 ? <p className="muted">{t("No daily puzzle scheduled from today. Students will see none.")}</p> : (
          <ul className="text-sm">{upcoming.map((p) => <li key={p.id}>{p.dailyDate === today ? <b>{t("Today")}</b> : p.dailyDate} — {p.title}</li>)}</ul>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="h2">{t("All puzzles")} <span className="text-base font-normal text-ink-soft">({show === "all" && !q ? allCount : t("{n} of {m}", { n: total, m: allCount })})</span></h2>
        <form className="flex flex-wrap gap-2">
          <input className="input w-48" name="q" defaultValue={q} placeholder={t("Search title or hint")} />
          <select className="input w-auto" name="show" defaultValue={show}>
            <option value="all">{t("All")}</option>
            <option value="scheduled">{t("Scheduled (from today)")}</option>
            <option value="past">{t("Past daily puzzles")}</option>
            <option value="unscheduled">{t("Not scheduled")}</option>
            <option value="unsolved">{t("Not solved by anyone yet")}</option>
          </select>
          <button className="btn-secondary">{t("Filter")}</button>
          {(q || show !== "all") && <a href="/admin/puzzles" className="btn-secondary">{t("Clear")}</a>}
        </form>
      </div>
      {pages > 1 && <p className="muted text-sm">{t("Page {p} of {n}", { p: page, n: pages })} · {t("{n} per page", { n: PAGE_SIZE })}</p>}
      <Pager />
      <div className="grid gap-4 lg:grid-cols-2">
        {puzzles.length === 0 && <Empty>{allCount === 0 ? t("No puzzles yet.") : t("No puzzles match the filter.")}</Empty>}
        {puzzles.map((p) => (
          <div key={p.id} className="card min-w-0">
            <div className="flex flex-wrap gap-4">
              <ChessBoard fen={p.fen} size={176} />
              <div className="min-w-[14rem] flex-1 space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{p.title}</span><span className="flex gap-1"><Link href={`/admin/puzzles/${p.id}`} className="btn btn-sm">▶ {t("Test")}</Link><Link href={`/admin/puzzles/${p.id}#edit`} className="btn-secondary btn-sm">✎ {t("Edit")}</Link></span></div>
                <div className="muted">{t("Rating")} {p.rating} · {t("solved by {n}", { n: p._count.solves })}</div>
                <div>{t("Solution")}: <code>{p.solution}</code>{p.altSolutions && <span className="ml-1 pill">+{p.altSolutions.split("\n").length} {t("alternative")}</span>}</div>
                <form action={setDaily} className="flex flex-wrap gap-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input className="input w-auto min-w-[10rem] flex-1 py-1" type="date" name="dailyDate" defaultValue={p.dailyDate ?? ""} />
                  <button className="btn-secondary btn-sm">{t("Set daily")}</button>
                </form>
                <form action={deletePuzzle}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-red-600 underline">{t("Delete")}</button></form>
              </div>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-brand">{t("Record solved in class")}</summary>
              <form action={recordSolves} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto text-sm">
                  {students.map((s) => <label key={s.id} className="flex gap-2"><input type="checkbox" name="studentId" value={s.id} />{s.firstName} {s.lastName.charAt(0)}. <span className="muted">{s.group?.name}</span></label>)}
                </div>
                <button className="btn-secondary btn-sm mt-2">{t("Save solves")}</button>
              </form>
            </details>
          </div>
        ))}
      </div>
      <Pager />
      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("New puzzle")}</h2>
        <form action={createPuzzle} className="grid-form">
          <Field label={t("Title")}><input className="input" name="title" required placeholder={t("Mate in 1")} /></Field>
          <Field label={t("Rating")}><input className="input" name="rating" type="number" defaultValue={1000} /></Field>
          <Field label="FEN" className="sm:col-span-2"><input className="input font-mono" name="fen" required placeholder="6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1" /></Field>
          <Field label={t("Solution (all moves, e.g. Rd8# or Qh5 Nf6 Qxf7#)")}><input className="input" name="solution" required /></Field>
          <Field label={t("Other correct solutions (optional) — one per line")} className="sm:col-span-2"><textarea className="input font-mono" name="altSolutions" rows={2} placeholder={t("e.g.\nHh5+ Kg8 Hh7#\nWe8+")} /></Field>
          <Field label={t("Hint")}><input className="input" name="hint" /></Field>
          <Field label={t("Daily puzzle date (optional)")}><input className="input" type="date" name="dailyDate" /></Field>
          <div className="flex items-end justify-end"><button className="btn">{t("Add puzzle")}</button></div>
        </form>
      </div>
    </div>
  );
}
