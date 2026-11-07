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

/** `moves` = everything played so far in UCI (student moves and the replies the server gave). */
export function stepPuzzle(fen: string, solution: string[], moves: string[]): StepResult {
  if (moves.length === 0 || moves.length % 2 === 0 || moves.length > solution.length + 1) return { status: "invalid" };
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { status: "invalid" };
  }
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i].match(uciRe);
    if (!m) return { status: "invalid" };
    let san: string;
    try {
      san = chess.move({ from: m[1], to: m[2], promotion: m[3] }).san;
    } catch {
      return { status: "invalid" };
    }
    const last = i === moves.length - 1;
    if (!last) {
      if (strip(san) !== strip(solution[i] ?? "")) return { status: "invalid" }; // earlier moves must follow the line
      continue;
    }
    // The student's new move.
    if (chess.isCheckmate()) return { status: "solved", byMate: strip(san) !== strip(solution[i] ?? "") };
    if (strip(san) !== strip(solution[i] ?? "")) return { status: "wrong" };
    if (i + 1 >= solution.length) return { status: "solved", byMate: false };
    const reply = chess.move(solution[i + 1]);
    const replyUci = reply.from + reply.to + (reply.promotion ?? "");
    if (i + 2 >= solution.length) return { status: "solved", byMate: false, replyUci }; // line ends with the opponent's move
    return { status: "correct", reply: reply.san, replyUci };
  }
  return { status: "invalid" };
}

/** Full solution as UCI moves, for the admin's "show solution". */
export function solutionUci(fen: string, solution: string[]): string[] {
  const chess = new Chess(fen);
  return solution.map((s) => {
    const m = chess.move(s);
    return m.from + m.to + (m.promotion ?? "");
  });
}
