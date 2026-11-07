import { test } from "node:test";
import assert from "node:assert/strict";
import { playMoves } from "./chess";

const FEN = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
test("valid mate in 1 (English and Polish letters)", () => {
  const r = playMoves(FEN, "Rd8#");
  assert.ok(r.ok && r.chess.isCheckmate());
  const pl = playMoves(FEN, "Wd8#");
  assert.ok(pl.ok && pl.played[0] === "Rd8#");
});
test("false mate claim is rejected", () => {
  const r = playMoves(FEN, "Rd7#");
  assert.equal(r.ok, false);
});
test("illegal move is rejected with legal moves listed", () => {
  const r = playMoves(FEN, "Qh5");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Legal moves/);
});
test("invalid FEN is rejected", () => {
  assert.equal(playMoves("not a fen", "e4").ok, false);
});

import { toPuzzle } from "./lichess";
test("lichess response → start FEN and SAN solution", () => {
  // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? → white mates with Qxf7#
  const p = toPuzzle({
    game: { id: "g", pgn: "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6" },
    puzzle: { id: "abc", rating: 650, solution: ["h5f7"], themes: ["mateIn1"], initialPly: 5 },
  });
  assert.ok(p);
  assert.deepEqual(p!.solution, ["Qxf7#"]);
  assert.match(p!.fen, / w KQkq - /);
  assert.equal(p!.url, "https://lichess.org/training/abc");
});
test("lichess response with an illegal solution is dropped", () => {
  assert.equal(toPuzzle({ game: { id: "g", pgn: "1. e4 e5" }, puzzle: { id: "x", rating: 1, solution: ["a1a8"], themes: [], initialPly: 1 } }), null);
});
