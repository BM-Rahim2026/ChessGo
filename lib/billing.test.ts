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

import { parseCsv, autoMap, normalizeRows, parseDate } from "./importer";

test("csv parsing: semicolons, quotes, BOM, CRLF", () => {
  const rows = parseCsv('﻿Vorname;Nachname;Notiz\r\nAnna;"Müller";"says ""hi""; ok"\r\n\r\nBen;Ko;\r\n');
  assert.deepEqual(rows, [["Vorname", "Nachname", "Notiz"], ["Anna", "Müller", 'says "hi"; ok'], ["Ben", "Ko", ""]]);
});
test("dates", () => {
  assert.equal(parseDate("04.03.2015"), "2015-03-04");
  assert.equal(parseDate("2015-03-04"), "2015-03-04");
  assert.equal(parseDate("3/14/2015"), "2015-03-14");
  assert.equal(parseDate("31.02.2015"), null);
  assert.equal(parseDate("04.03.15"), "2015-03-04");
  assert.equal(parseDate("45000"), "2023-03-15");
});
test("auto mapping + normalisation (English full names)", () => {
  const rows = parseCsv("Name,Date of Birth,Group,Status,Parent,E-Mail,Mobile\nJane Doe,2016-05-01,Knights,Active,John Doe,JOHN@x.com,+49 1\nMax Mustermann,,,inactive,,,\n");
  const m = autoMap(rows[0]);
  assert.deepEqual(m, { studentName: 0, birthDate: 1, group: 2, status: 3, parentName: 4, parentEmail: 5, parentPhone: 6 });
  const [a, b] = normalizeRows(rows, m);
  assert.equal(a.studentFirst, "Jane"); assert.equal(a.studentLast, "Doe"); assert.equal(a.parentEmail, "john@x.com");
  assert.equal(a.active, true); assert.equal(b.active, false); assert.equal(b.parentEmail, null);
});
test("auto mapping (German headers)", () => {
  const m = autoMap(["Vorname", "Nachname", "Geburtsdatum", "Gruppe", "Erziehungsberechtigter", "E-Mail-Adresse", "Telefon"]);
  assert.deepEqual(m, { studentFirst: 0, studentLast: 1, birthDate: 2, group: 3, parentName: 4, parentEmail: 5, parentPhone: 6 });
});
