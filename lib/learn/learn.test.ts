import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { CHAPTERS, ALL_LEVELS } from "./levels";
import { bestMoves, chessMoveResult, verifyLevel } from "./engine";

test("level ids are unique", () => {
  assert.equal(new Set(ALL_LEVELS.map((l) => l.id)).size, ALL_LEVELS.length);
});

for (const ch of CHAPTERS) for (const lvl of ch.levels) {
  test(`${lvl.id} is solvable`, () => {
    if (lvl.goal === "collect" || lvl.goal === "capture") {
      const best = bestMoves(lvl);
      assert.ok(best >= 1, `best=${best}`);
    } else {
      const c = new Chess(lvl.fen); // throws on an invalid FEN
      assert.equal(c.turn(), "w");
      assert.ok(!c.isGameOver(), "position already finished");
      if (lvl.goal === "escape") assert.ok(c.inCheck(), "escape level must start in check");
      const winning = c.moves({ verbose: true }).filter((m) => chessMoveResult(lvl, m.from + m.to + (m.promotion ?? "")).done);
      assert.ok(winning.length >= 1, "no move reaches the goal");
    }
  });
}

test("verifyLevel scores stars and rejects cheating", () => {
  const rook = ALL_LEVELS.find((l) => l.id === "wieza-2")!;
  assert.equal(verifyLevel(rook, ["a1a8", "a8h8"]), 3);
  assert.equal(verifyLevel(rook, ["a1a8"]), 0); // unfinished
  assert.equal(verifyLevel(rook, ["a1h8"]), 0); // illegal rook move
  const mate = ALL_LEVELS.find((l) => l.id === "mat-1")!;
  assert.equal(verifyLevel(mate, ["a1a8"]), 3);
  assert.equal(verifyLevel(mate, ["a1a7", "a1a8"]), 2);
  assert.equal(verifyLevel(mate, ["a1a7"]), 0);
});
