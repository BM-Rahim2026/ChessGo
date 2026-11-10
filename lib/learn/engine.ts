import { Chess } from "chess.js";

/**
 * Learn-to-play engine. Two kinds of level:
 *  - "board" levels (collect stars / capture pieces): only the learner's pieces move, the other
 *    pieces stand still as targets. Simple movement rules, no kings or check needed.
 *  - "chess" levels (check, escape, mate, castling): a real position played with chess.js;
 *    the learner makes one move that must reach the goal.
 * Pure TypeScript: used in the browser to play and on the server to verify before saving.
 */

export type Goal = "collect" | "capture" | "check" | "escape" | "mate" | "castle";

export type Level = {
  id: string;
  goal: Goal;
  /** board levels: pieces like "Ra1 pc5" — uppercase = learner, lowercase = targets that stand still */
  pieces?: string;
  stars?: string[];
  /** chess levels: full FEN, white to move */
  fen?: string;
  text: { pl: string; en: string };
};

export type Piece = { type: string; white: boolean };
export type Board = Map<string, Piece>; // "e4" → piece

const FILES = "abcdefgh";
const sq = (f: number, r: number) => FILES[f] + (r + 1);
const fr = (s: string) => [FILES.indexOf(s[0]), Number(s[1]) - 1] as const;
const inside = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8;

export function parsePieces(pieces: string): Board {
  const b: Board = new Map();
  for (const tok of pieces.trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([KQRBNPkqrbnp])([a-h][1-8])$/);
    if (m) b.set(m[2], { type: m[1].toLowerCase(), white: m[1] === m[1].toUpperCase() });
  }
  return b;
}

const DIRS: Record<string, [number, number][]> = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  k: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
  n: [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]],
};

/** Target squares for the learner's piece on `from` (board levels). */
export function boardMoves(b: Board, from: string): string[] {
  const p = b.get(from);
  if (!p || !p.white) return [];
  const [f, r] = fr(from);
  const out: string[] = [];
  const free = (s: string) => !b.has(s);
  const enemy = (s: string) => { const x = b.get(s); return Boolean(x && !x.white); };
  if (p.type === "p") {
    if (inside(f, r + 1) && free(sq(f, r + 1))) {
      out.push(sq(f, r + 1));
      if (r === 1 && free(sq(f, r + 2))) out.push(sq(f, r + 2));
    }
    for (const df of [-1, 1]) if (inside(f + df, r + 1) && enemy(sq(f + df, r + 1))) out.push(sq(f + df, r + 1));
    return out;
  }
  const slide = p.type === "r" || p.type === "b" || p.type === "q";
  for (const [df, dr] of DIRS[p.type] ?? []) {
    let nf = f + df, nr = r + dr;
    while (inside(nf, nr)) {
      const s = sq(nf, nr);
      if (free(s)) out.push(s);
      else { if (enemy(s)) out.push(s); break; }
      if (!slide) break;
      nf += df; nr += dr;
    }
  }
  return out;
}

export type BoardState = { board: Board; stars: Set<string> };

export function startBoard(level: Level): BoardState {
  return { board: parsePieces(level.pieces ?? ""), stars: new Set(level.stars ?? []) };
}

/** Apply a learner move on a board level (assumes it is legal). Pawns on the last rank become queens. */
export function applyBoardMove(st: BoardState, from: string, to: string): BoardState {
  const board = new Map(st.board);
  const p = board.get(from)!;
  board.delete(from);
  board.set(to, p.type === "p" && to[1] === "8" ? { type: "q", white: true } : p);
  const stars = new Set(st.stars);
  stars.delete(to);
  return { board, stars };
}

export function boardDone(level: Level, st: BoardState) {
  if (level.goal === "collect") return st.stars.size === 0;
  return [...st.board.values()].every((p) => p.white); // capture: nothing left to take
}

/** Fewest moves to finish a board level (breadth-first search). */
export function bestMoves(level: Level): number {
  const key = (st: BoardState) =>
    [...st.board.entries()].map(([s, p]) => (p.white ? p.type.toUpperCase() : p.type) + s).sort().join(",") + "|" + [...st.stars].sort().join(",");
  let frontier = [startBoard(level)];
  const seen = new Set([key(frontier[0])]);
  for (let depth = 0; depth < 40 && frontier.length; depth++) {
    const next: BoardState[] = [];
    for (const st of frontier) {
      if (boardDone(level, st)) return depth;
      for (const [from, p] of st.board) {
        if (!p.white) continue;
        for (const to of boardMoves(st.board, from)) {
          const n = applyBoardMove(st, from, to);
          const k = key(n);
          if (!seen.has(k)) { seen.add(k); next.push(n); }
        }
      }
    }
    frontier = next;
  }
  return -1; // unsolvable
}

/** 3 stars at the best number of moves, 2 stars up to two extra moves, otherwise 1. */
export function starsFor(moves: number, best: number) {
  return moves <= best ? 3 : moves <= best + 2 ? 2 : 1;
}

/** Does this single move complete a chess level? */
export function chessMoveResult(level: Level, uci: string): { legal: boolean; done: boolean } {
  const chess = new Chess(level.fen);
  let m;
  try {
    m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
  } catch {
    return { legal: false, done: false };
  }
  const done =
    level.goal === "mate" ? chess.isCheckmate()
    : level.goal === "check" ? chess.inCheck()
    : level.goal === "escape" ? true // any legal move gets out of check
    : level.goal === "castle" ? m.isKingsideCastle() || m.isQueensideCastle()
    : false;
  return { legal: true, done };
}

/** Server-side check of a finished level: replays the moves and returns the stars earned (0 = not finished). */
export function verifyLevel(level: Level, moves: string[]): number {
  if (!Array.isArray(moves) || moves.length === 0 || moves.length > 60) return 0;
  if (level.goal === "collect" || level.goal === "capture") {
    let st = startBoard(level);
    for (const mv of moves) {
      const from = mv.slice(0, 2), to = mv.slice(2, 4);
      if (!boardMoves(st.board, from).includes(to)) return 0;
      st = applyBoardMove(st, from, to);
      if (boardDone(level, st)) break;
    }
    if (!boardDone(level, st)) return 0;
    return starsFor(moves.length, bestMoves(level));
  }
  // chess levels: the last move must reach the goal; earlier tries were mistakes
  const ok = chessMoveResult(level, moves[moves.length - 1]);
  if (!ok.legal || !ok.done) return 0;
  return moves.length === 1 ? 3 : moves.length <= 3 ? 2 : 1;
}
