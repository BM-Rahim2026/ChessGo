import { Chess } from "chess.js";
import { sanFromPolish } from "./i18n/core";

/**
 * Interactive puzzle logic (pure, used on the server so the solution never reaches the browser).
 * The student plays the moves at even indices of the solution; odd indices are the opponent's
 * replies, played automatically. Any move that gives checkmate also counts as solving.
 */

const strip = (san: string) => san.replace(/[+#!?]/g, "");

/** Stored solution (SAN in English or Polish letters, or UCI) → SAN list, legal from the FEN. */
export function parseSolution(fen: string, solution: string): string[] {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const raw of solution.trim().split(/\s+/).filter(Boolean)) {
    const tok = raw.replace(/^\d+\.(\.\.)?/, "");
    if (!tok) continue;
    let san: string | null = null;
    try {
      san = chess.move(sanFromPolish(tok)).san;
    } catch {
      const m = tok.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/i);
      if (m) {
        try {
          san = chess.move({ from: m[1].toLowerCase(), to: m[2].toLowerCase(), promotion: m[3]?.toLowerCase() }).san;
        } catch { /* illegal */ }
      }
    }
    if (!san) break; // keep the valid prefix
    out.push(san);
  }
  return out;
}

export type StepResult =
  | { status: "correct"; reply: string; replyUci: string } // right move, opponent answers
  | { status: "solved"; byMate: boolean; replyUci?: string }
  | { status: "wrong" }
  | { status: "invalid" }; // tampered or out-of-sync request

const uciRe = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/**
 * `moves` = everything played so far in UCI (student moves and the replies the server gave).
 * `solution` = the main line, or several accepted lines (main first, then alternatives).
 * A move is correct when it continues any accepted line that matches the moves so far;
 * any checkmating move also solves the puzzle.
 */
export function stepPuzzle(fen: string, solution: string[] | string[][], moves: string[]): StepResult {
  const lines = (Array.isArray(solution[0]) ? (solution as string[][]) : [solution as string[]]).filter((l) => l.length > 0);
  const longest = Math.max(0, ...lines.map((l) => l.length));
  if (lines.length === 0 || moves.length === 0 || moves.length % 2 === 0 || moves.length > longest + 1) return { status: "invalid" };
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { status: "invalid" };
  }
  let candidates = lines;
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i].match(uciRe);
    if (!m) return { status: "invalid" };
    let san: string;
    try {
      san = chess.move({ from: m[1], to: m[2], promotion: m[3] }).san;
    } catch {
      return { status: "invalid" };
    }
    const matching = candidates.filter((l) => strip(l[i] ?? "") === strip(san));
    const last = i === moves.length - 1;
    if (!last) {
      if (matching.length === 0) return { status: "invalid" }; // earlier moves must follow an accepted line
      candidates = matching;
      continue;
    }
    // The student's new move.
    if (chess.isCheckmate()) return { status: "solved", byMate: matching.length === 0 };
    if (matching.length === 0) return { status: "wrong" };
    if (matching.some((l) => i + 1 >= l.length)) return { status: "solved", byMate: false };
    const line = matching[0];
    const reply = chess.move(line[i + 1]);
    const replyUci = reply.from + reply.to + (reply.promotion ?? "");
    if (i + 2 >= line.length) return { status: "solved", byMate: false, replyUci }; // line ends with the opponent's move
    return { status: "correct", reply: reply.san, replyUci };
  }
  return { status: "invalid" };
}

/** Accepted lines of a puzzle: the main solution plus alternatives (one per line of text). */
export function puzzleLines(fen: string, solution: string, alternatives: string | null | undefined): string[][] {
  return [solution, ...(alternatives ?? "").split("\n")].map((l) => l.trim()).filter(Boolean).map((l) => parseSolution(fen, l)).filter((l) => l.length > 0);
}

/**
 * Check typed alternative solutions (one per line). Returns the SAN lines joined for storage,
 * or the 1-based number of the first wrong line.
 */
export function strictAlternatives(fen: string, raw: string, main: string[]): { ok: true; value: string | null } | { ok: false; line: number } {
  const rows = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const [i, r] of rows.entries()) {
    const l = strictSolution(fen, r);
    if (!l) return { ok: false, line: i + 1 };
    const key = l.join(" ");
    if (key !== main.join(" ") && !out.includes(key)) out.push(key);
  }
  return { ok: true, value: out.length ? out.join("\n") : null };
}

/** Full solution as UCI moves, for the admin's "show solution". */
export function solutionUci(fen: string, solution: string[]): string[] {
  const chess = new Chess(fen);
  return solution.map((s) => {
    const m = chess.move(s);
    return m.from + m.to + (m.promotion ?? "");
  });
}

/**
 * Check a typed solution: every move legal, and "#"/"+" only where the move really mates / checks.
 * Returns the SAN line, or null when the solution is wrong.
 */
export function strictSolution(fen: string, raw: string): string[] | null {
  const line = parseSolution(fen, raw);
  const tokens = raw.split(/\s+/).map((x) => x.replace(/^\d+\.(\.\.)?/, "")).filter(Boolean);
  if (line.length === 0 || line.length !== tokens.length) return null;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].includes("#") && !line[i].endsWith("#")) return null;
    if (tokens[i].includes("+") && !/[+#]$/.test(line[i])) return null;
  }
  return line;
}
