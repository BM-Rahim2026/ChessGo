import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyFee } from "./billing";
import { nextStreak, displayStreak } from "./streak";
import { toCsv } from "./csv";

const base = { pricePerStudentCts: 50, minCts: 1500, maxCts: 15000, trialEndsAt: new Date("2020-01-01") };

test("min fee applies to small clubs", () => {
  assert.equal(monthlyFee({ ...base, activeStudents: 10, period: "2026-11" }).amountCts, 1500);
});
test("per-student fee between min and max", () => {
  assert.equal(monthlyFee({ ...base, activeStudents: 80, period: "2026-11" }).amountCts, 4000);
});
test("max fee caps large clubs", () => {
  assert.equal(monthlyFee({ ...base, activeStudents: 1000, period: "2026-11" }).amountCts, 15000);
});
test("month fully in trial is free", () => {
  const r = monthlyFee({ ...base, activeStudents: 80, period: "2026-11", trialEndsAt: new Date("2026-12-05T00:00:00Z") });
  assert.equal(r.amountCts, 0);
  assert.equal(r.inTrial, true);
});
test("trial ending mid-month is prorated", () => {
  // Nov has 30 days; trial ends at the start of Nov 16 → 15 billable days
  const r = monthlyFee({ ...base, activeStudents: 80, period: "2026-11", trialEndsAt: new Date("2026-11-16T00:00:00Z") });
  assert.equal(r.billableDays, 15);
  assert.equal(r.amountCts, 2000);
});
test("streaks", () => {
  assert.deepEqual(nextStreak(null, "2026-11-06", 0), { streak: 1, changed: true });
  assert.deepEqual(nextStreak("2026-11-05", "2026-11-06", 3), { streak: 4, changed: true });
  assert.deepEqual(nextStreak("2026-11-06", "2026-11-06", 4), { streak: 4, changed: false });
  assert.deepEqual(nextStreak("2026-11-03", "2026-11-06", 4), { streak: 1, changed: true });
  assert.deepEqual(nextStreak("2026-02-28", "2026-03-01", 2), { streak: 3, changed: true });
  assert.equal(displayStreak("2026-11-03", "2026-11-06", 4), 0);
});
test("csv escaping and formula guard", () => {
  const out = toCsv([{ a: 'x,"y"', b: "=SUM(1)" }]);
  assert.equal(out, '﻿a,b\r\n"x,""y""",\'=SUM(1)\r\n');
});
