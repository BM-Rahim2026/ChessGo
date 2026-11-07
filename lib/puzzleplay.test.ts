import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSolution, stepPuzzle } from "./puzzleplay";

const BACK_RANK = "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
// Scholar's-mate setup, white to move: 1. Qxf7#
const SCHOLAR = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";

test("parseSolution accepts English, Polish and UCI", () => {
  assert.deepEqual(parseSolution(BACK_RANK, "Rd8#"), ["Rd8#"]);
  assert.deepEqual(parseSolution(BACK_RANK, "Wd8"), ["Rd8#"]);
  assert.deepEqual(parseSolution(BACK_RANK, "d1d8"), ["Rd8#"]);
  assert.deepEqual(parseSolution(BACK_RANK, "Rd7 h6 Rd8+"), ["Rd7", "h6", "Rd8+"]);
  assert.deepEqual(parseSolution(BACK_RANK, "Qh5"), []);
});

test("one-move puzzle: right, wrong, alternative mate", () => {
  const sol = parseSolution(BACK_RANK, "Rd8#");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d8"]).status, "solved");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d7"]).status, "wrong");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d9"]).status, "invalid");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["a1a8"]).status, "invalid"); // illegal
  const scholar = parseSolution(SCHOLAR, "Qxf7#");
  const r = stepPuzzle(SCHOLAR, scholar, ["h5f7"]);
  assert.equal(r.status, "solved");
});

test("multi-move puzzle plays the reply and checks later moves", () => {
  const sol = parseSolution(BACK_RANK, "Rd7 h6 Rd8+");
  const first = stepPuzzle(BACK_RANK, sol, ["d1d7"]);
  assert.equal(first.status, "correct");
  assert.ok(first.status === "correct" && first.replyUci === "h7h6");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d7", "h7h6", "d7d8"]).status, "solved");
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d7", "h7h6", "d7a7"]).status, "wrong");
  // A forged reply that is not the stored one is rejected.
  assert.equal(stepPuzzle(BACK_RANK, sol, ["d1d7", "g7g6", "d7d8"]).status, "invalid");
});
