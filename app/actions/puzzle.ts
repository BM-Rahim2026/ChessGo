"use server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { portalContext } from "@/lib/portal";
import { dayKey } from "@/lib/format";
import { solvePuzzle } from "@/lib/gamification";
import { parseSolution, solutionUci, stepPuzzle } from "@/lib/puzzleplay";

export type MoveResponse =
  | { status: "correct"; replyUci: string }
  | { status: "solved"; replyUci?: string; byMate: boolean; gained?: number; already?: boolean }
  | { status: "wrong" }
  | { status: "error" };

/** Student plays a move on a puzzle they can see (daily up to today, or practice). */
export async function studentPuzzleMove(puzzleId: string, moves: string[]): Promise<MoveResponse> {
  const { student } = await portalContext();
  if (!student || !Array.isArray(moves) || moves.length > 40) return { status: "error" };
  const p = await db.puzzle.findFirst({
    where: { id: String(puzzleId), clubId: student.clubId, OR: [{ dailyDate: null }, { dailyDate: { lte: dayKey() } }] },
  });
  if (!p) return { status: "error" };
  const r = stepPuzzle(p.fen, parseSolution(p.fen, p.solution), moves.map(String));
  if (r.status === "invalid") return { status: "error" };
  if (r.status === "wrong") return { status: "wrong" };
  if (r.status === "correct") return { status: "correct", replyUci: r.replyUci };
  const done = await solvePuzzle(student.id, p.id);
  return { status: "solved", replyUci: r.replyUci, byMate: r.byMate, gained: done.gained, already: done.alreadySolved };
}

/** Admin/coach testing a puzzle: same checks, no XP. */
export async function testPuzzleMove(puzzleId: string, moves: string[]): Promise<MoveResponse> {
  const u = await currentUser();
  if (!u?.clubId || !["club_admin", "coach"].includes(u.role) || !Array.isArray(moves) || moves.length > 40) return { status: "error" };
  const p = await db.puzzle.findFirst({ where: { id: String(puzzleId), clubId: u.clubId } });
  if (!p) return { status: "error" };
  const r = stepPuzzle(p.fen, parseSolution(p.fen, p.solution), moves.map(String));
  if (r.status === "invalid") return { status: "error" };
  if (r.status === "wrong") return { status: "wrong" };
  if (r.status === "correct") return { status: "correct", replyUci: r.replyUci };
  return { status: "solved", replyUci: r.replyUci, byMate: r.byMate };
}

/** Admin/coach: the whole line, to replay "show solution". */
export async function puzzleSolutionForStaff(puzzleId: string): Promise<string[]> {
  const u = await currentUser();
  if (!u?.clubId || !["club_admin", "coach"].includes(u.role)) return [];
  const p = await db.puzzle.findFirst({ where: { id: String(puzzleId), clubId: u.clubId } });
  return p ? solutionUci(p.fen, parseSolution(p.fen, p.solution)) : [];
}
