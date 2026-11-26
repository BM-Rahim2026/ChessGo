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

import { strictSolution } from "./puzzleplay";
test("strictSolution rejects false mate/check marks and typos", () => {
  assert.deepEqual(strictSolution(BACK_RANK, "Wd8#"), ["Rd8#"]);
  assert.equal(strictSolution(BACK_RANK, "Wd7#"), null); // not mate
  assert.equal(strictSolution(BACK_RANK, "Rd7+"), null); // not check
  assert.deepEqual(strictSolution(BACK_RANK, "1. Rd7 h6 2. Rd8+"), ["Rd7", "h6", "Rd8+"]);
  assert.equal(strictSolution(BACK_RANK, "Rd8# Kh7"), null); // move after mate
});

import { puzzleLines, strictAlternatives } from "./puzzleplay";
test("alternative solutions: any accepted line is correct", () => {
  // Main: Rd7 h6 Rd8+ ; alternative first move: Rd8# (mate) and a non-mate alternative line Rc1 h6 Rc8+
  const lines = puzzleLines(BACK_RANK, "Rd7 h6 Rd8+", "Rc1 h6 Rc8+\nRe1 h6 Re8+");
  assert.equal(lines.length, 3);
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1c1"]).status, "correct"); // alternative 1st move
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1e1"]).status, "correct"); // alternative 2
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1c1", "h7h6", "c1c8"]).status, "solved");
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1c1", "h7h6", "c1c7"]).status, "wrong");
  // mixing lines is not allowed: Rc1 then the main line's Rd8
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1c1", "h7h6", "d1d8"]).status, "invalid");
  assert.equal(stepPuzzle(BACK_RANK, lines, ["d1b1"]).status, "wrong");
});
test("strictAlternatives validates each line and drops duplicates", () => {
  const main = ["Rd8#"];
  assert.deepEqual(strictAlternatives(BACK_RANK, "Wd8#\nRd7 h6 Rd8+", main), { ok: true, value: "Rd7 h6 Rd8+" });
  assert.deepEqual(strictAlternatives(BACK_RANK, "Rd7#", main), { ok: false, line: 1 });
  assert.deepEqual(strictAlternatives(BACK_RANK, "  ", main), { ok: true, value: null });
});
