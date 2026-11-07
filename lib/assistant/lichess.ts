import { Chess } from "chess.js";

/**
 * Puzzles from the Lichess puzzle database (released under CC0 / public domain).
 * API: GET https://lichess.org/api/puzzle/next?angle=<theme>&difficulty=<level> (no account needed).
 * The response has the game's PGN up to the puzzle and the solution in UCI.
 */

export const LICHESS_THEMES = [
  "mateIn1", "mateIn2", "mateIn3", "backRankMate", "smotheredMate", "fork", "pin", "skewer", "discoveredAttack",
  "doubleCheck", "hangingPiece", "trappedPiece", "sacrifice", "deflection", "attraction", "promotion",
  "endgame", "rookEndgame", "pawnEndgame", "opening", "middlegame", "short", "oneMove", "advantage", "crushing",
] as const;
export const LICHESS_DIFFICULTY = ["easiest", "easier", "normal", "harder", "hardest"] as const;

type LichessResponse = {
  game: { id: string; pgn: string };
  puzzle: { id: string; rating: number; solution: string[]; themes: string[]; initialPly: number };
};

export type ImportedPuzzle = { id: string; fen: string; solution: string[]; rating: number; themes: string[]; url: string; endsInMate: boolean };

function uciMove(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined }).san;
}

/** Turn the API answer into a start FEN + SAN solution, checking every move is legal. */
export function toPuzzle(data: LichessResponse): ImportedPuzzle | null {
  const { puzzle, game } = data;
  if (!puzzle?.solution?.length || !game?.pgn) return null;
  const full = new Chess();
  try {
    full.loadPgn(game.pgn);
  } catch {
    return null;
  }
  const history = full.history();
  // The puzzle starts after the PGN; fall back to nearby plies in case the PGN length differs.
  for (const plies of [history.length, puzzle.initialPly + 1, puzzle.initialPly]) {
    if (plies < 0 || plies > history.length) continue;
    const start = new Chess();
    try {
      for (const san of history.slice(0, plies)) start.move(san);
      const fen = start.fen();
      const solution = puzzle.solution.map((u) => uciMove(start, u));
      return {
        id: puzzle.id, fen, solution, rating: puzzle.rating, themes: puzzle.themes,
        url: `https://lichess.org/training/${puzzle.id}`, endsInMate: start.isCheckmate(),
      };
    } catch {
      continue; // illegal from this ply: try the next candidate
    }
  }
  return null;
}

export async function fetchLichessPuzzle(theme?: string, difficulty?: string): Promise<ImportedPuzzle | null> {
  const url = new URL("https://lichess.org/api/puzzle/next");
  if (theme) url.searchParams.set("angle", theme);
  if (difficulty) url.searchParams.set("difficulty", difficulty);
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ChessGo-Academy (club management app)" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);
  return toPuzzle((await res.json()) as LichessResponse);
}
