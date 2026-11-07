import { Chess } from "chess.js";
import { sanFromPolish } from "../i18n/core";

/** Play SAN moves (English or Polish piece letters) from a FEN. */
export function playMoves(fen: string, moves: string) {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch (e) {
    return { ok: false as const, error: `Invalid FEN: ${(e as Error).message}` };
  }
  const played: string[] = [];
  for (const raw of moves.trim().split(/\s+/).filter(Boolean)) {
    const mv = sanFromPolish(raw.replace(/^\d+\.(\.\.)?/, ""));
    if (!mv) continue;
    try {
      played.push(chess.move(mv).san);
    } catch {
      return { ok: false as const, error: `Illegal move "${raw}" after ${played.join(" ") || "the start position"}. Legal moves there: ${chess.moves().join(", ")}` };
    }
    // The move parser ignores +/#, so check the claims ourselves.
    if (raw.includes("#") && !chess.isCheckmate())
      return { ok: false as const, error: `"${raw}" is marked as checkmate but it is not mate (after ${played.join(" ")}). Legal replies: ${chess.moves().join(", ")}` };
    if (raw.endsWith("+") && !chess.inCheck())
      return { ok: false as const, error: `"${raw}" is marked as check but gives no check (after ${played.join(" ")}).` };
  }
  return { ok: true as const, chess, played };
}

