import "server-only";
import { db } from "./db";
import type { BadgeMetric, XpReason } from "./types";
import { dayKey } from "./format";
import { nextStreak, STREAK_BONUS_EVERY, STREAK_BONUS_XP } from "./streak";
import { sanFromPolish } from "./i18n/core";

export const XP = {
  attendance_present: 10,
  attendance_late: 5,
  puzzle: 5,
  daily_puzzle: 10,
  tournament_game: 5,
  tournament_game_win: 5, // extra on top of playing
  tournament_game_draw: 2,
  tournament_win: 50,
} as const;

export { DEFAULT_BADGES } from "./badges";
import { DEFAULT_BADGES } from "./badges";

export async function ensureDefaultBadges(clubId: string) {
  for (const b of DEFAULT_BADGES) {
    // Keep default badge names/icons in line with the brand (e.g. no flame imagery).
    await db.badge.upsert({ where: { clubId_code: { clubId, code: b.code } }, update: { name: b.name, description: b.description, icon: b.icon }, create: { ...b, clubId } });
  }
}

/**
 * Set the XP granted for one source (idempotent). Calling again with a new amount adjusts the
 * student's total by the difference; amount 0 revokes it. sourceKey null = always a new event (bonus).
 */
export async function setXp(opts: {
  clubId: string; studentId: string; sourceKey: string | null; amount: number;
  reason: XpReason; note?: string | null; awardedById?: string | null;
}) {
  const { clubId, studentId, sourceKey, amount, reason } = opts;
  await db.$transaction(async (tx) => {
    let delta = amount;
    if (sourceKey) {
      const prev = await tx.xpEvent.findUnique({ where: { studentId_sourceKey: { studentId, sourceKey } } });
      if (prev) {
        delta = amount - prev.amount;
        if (amount === 0) await tx.xpEvent.delete({ where: { id: prev.id } });
        else if (delta !== 0) await tx.xpEvent.update({ where: { id: prev.id }, data: { amount } });
      } else if (amount !== 0) {
        await tx.xpEvent.create({ data: { clubId, studentId, sourceKey, amount, reason, note: opts.note, awardedById: opts.awardedById } });
      }
    } else if (amount !== 0) {
      await tx.xpEvent.create({ data: { clubId, studentId, amount, reason, note: opts.note, awardedById: opts.awardedById } });
    }
    if (delta !== 0) await tx.student.update({ where: { id: studentId }, data: { xp: { increment: delta } } });
  });
  await evaluateBadges(studentId);
}

export async function studentMetrics(studentId: string): Promise<Record<BadgeMetric, number>> {
  const [s, sessions, puzzles, tournaments, wins] = await Promise.all([
    db.student.findUniqueOrThrow({ where: { id: studentId } }),
    db.attendance.count({ where: { studentId, status: { in: ["present", "late"] } } }),
    db.puzzleSolve.count({ where: { studentId } }),
    db.tournamentGame.findMany({
      where: { OR: [{ whiteId: studentId }, { blackId: studentId }], result: { not: null } },
      select: { tournamentId: true }, distinct: ["tournamentId"],
    }),
    db.tournament.count({ where: { winnerId: studentId } }),
  ]);
  return { sessions, puzzles, tournaments: tournaments.length, tournament_wins: wins, best_streak: s.bestStreak, xp: s.xp };
}

/** Award any threshold badges the student now qualifies for. Badges are never revoked automatically. */
export async function evaluateBadges(studentId: string) {
  const s = await db.student.findUnique({ where: { id: studentId }, include: { badges: true } });
  if (!s) return [];
  const owned = new Set(s.badges.map((b) => b.badgeId));
  const badges = await db.badge.findMany({ where: { clubId: s.clubId, metric: { not: null }, threshold: { not: null } } });
  const pending = badges.filter((b) => !owned.has(b.id));
  if (!pending.length) return [];
  const m = await studentMetrics(studentId);
  const earned = pending.filter((b) => m[b.metric as BadgeMetric] >= (b.threshold ?? Infinity));
  for (const b of earned) {
    await db.studentBadge.create({ data: { studentId, badgeId: b.id } }).catch(() => {});
  }
  return earned;
}

export async function recordAttendanceXp(clubId: string, attendanceId: string, studentId: string, status: string) {
  const amount = status === "present" ? XP.attendance_present : status === "late" ? XP.attendance_late : 0;
  await setXp({ clubId, studentId, sourceKey: `att:${attendanceId}`, amount, reason: "attendance" });
}

/** Mark a puzzle solved (student self-solve or coach recording). Returns XP gained. */
export async function solvePuzzle(studentId: string, puzzleId: string, today = dayKey()) {
  const puzzle = await db.puzzle.findUniqueOrThrow({ where: { id: puzzleId } });
  const existing = await db.puzzleSolve.findUnique({ where: { puzzleId_studentId: { puzzleId, studentId } } });
  if (existing) return { gained: 0, alreadySolved: true, streak: null as number | null };
  await db.puzzleSolve.create({ data: { puzzleId, studentId } });

  const isDaily = puzzle.dailyDate === today;
  let gained = isDaily ? XP.daily_puzzle : XP.puzzle;
  await setXp({ clubId: puzzle.clubId, studentId, sourceKey: `puz:${puzzleId}`, amount: gained, reason: isDaily ? "daily_puzzle" : "puzzle" });

  let streak: number | null = null;
  if (isDaily) {
    const s = await db.student.findUniqueOrThrow({ where: { id: studentId } });
    const n = nextStreak(s.lastPuzzleDay, today, s.streak);
    streak = n.streak;
    if (n.changed) {
      await db.student.update({
        where: { id: studentId },
        data: { streak: n.streak, lastPuzzleDay: today, bestStreak: Math.max(s.bestStreak, n.streak) },
      });
      if (n.streak % STREAK_BONUS_EVERY === 0) {
        await setXp({ clubId: puzzle.clubId, studentId, sourceKey: `streak:${today}`, amount: STREAK_BONUS_XP, reason: "streak_bonus", note: `${n.streak}-day streak` });
        gained += STREAK_BONUS_XP;
      }
      await evaluateBadges(studentId);
    }
  }
  return { gained, alreadySolved: false, streak };
}

export function normalizeMove(m: string) {
  return m.trim().toLowerCase().replace(/[+#!?x\-=\s]/g, "").replace(/^0/, "o");
}

/** Accepts English (K Q R B N) and Polish (K H W G S) piece letters. */
export function checkSolution(answer: string, solution: string) {
  answer = sanFromPolish(answer.trim());
  const first = solution.trim().split(/\s+/)[0] ?? "";
  return normalizeMove(answer) !== "" && normalizeMove(answer) === normalizeMove(first);
}

/** XP for both players of a game, recomputed whenever the result changes. */
export async function recordGameXp(clubId: string, gameId: string, whiteId: string, blackId: string, result: string | null) {
  const forSide = (side: "w" | "b") => {
    if (!result) return 0;
    const win = (result === "1-0" && side === "w") || (result === "0-1" && side === "b");
    const draw = result === "1/2-1/2";
    return XP.tournament_game + (win ? XP.tournament_game_win : draw ? XP.tournament_game_draw : 0);
  };
  await setXp({ clubId, studentId: whiteId, sourceKey: `game:${gameId}`, amount: forSide("w"), reason: "tournament_game" });
  await setXp({ clubId, studentId: blackId, sourceKey: `game:${gameId}`, amount: forSide("b"), reason: "tournament_game" });
}

export function standings(
  entries: { id: string; firstName: string; lastName: string }[],
  games: { whiteId: string; blackId: string; result: string | null }[],
) {
  const pts = new Map(entries.map((e) => [e.id, { ...e, points: 0, played: 0 }]));
  for (const g of games) {
    if (!g.result) continue;
    const w = pts.get(g.whiteId), b = pts.get(g.blackId);
    if (w) w.played++;
    if (b) b.played++;
    if (g.result === "1-0" && w) w.points += 1;
    else if (g.result === "0-1" && b) b.points += 1;
    else if (g.result === "1/2-1/2") { if (w) w.points += 0.5; if (b) b.points += 0.5; }
  }
  return [...pts.values()].sort((a, b) => b.points - a.points || a.firstName.localeCompare(b.firstName));
}

/** Group leaderboard: FIRST NAMES ONLY (privacy), plus last-initial when two kids share a first name. */
export async function groupLeaderboard(groupId: string, period: "all" | "month" = "all") {
  // Catch up badges (e.g. thresholds reached via attendance) so counts are current.
  for (const s of await db.student.findMany({ where: { groupId, status: "active" }, select: { id: true } })) await evaluateBadges(s.id);
  const students = await db.student.findMany({
    where: { groupId, status: "active" },
    select: { id: true, firstName: true, lastName: true, xp: true, streak: true, lastPuzzleDay: true, _count: { select: { badges: true } } },
  });
  let scores = new Map(students.map((s) => [s.id, s.xp]));
  if (period === "month") {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const sums = await db.xpEvent.groupBy({
      by: ["studentId"], where: { studentId: { in: students.map((s) => s.id) }, createdAt: { gte: start } }, _sum: { amount: true },
    });
    scores = new Map(students.map((s) => [s.id, 0]));
    for (const r of sums) scores.set(r.studentId, r._sum.amount ?? 0);
  }
  const counts = new Map<string, number>();
  for (const s of students) counts.set(s.firstName, (counts.get(s.firstName) ?? 0) + 1);
  return students
    .map((s) => ({
      id: s.id,
      name: (counts.get(s.firstName) ?? 0) > 1 ? `${s.firstName} ${s.lastName.charAt(0)}.` : s.firstName,
      xp: scores.get(s.id) ?? 0,
      badges: s._count.badges,
    }))
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Move Trail: was the daily puzzle solved on each of the last `days` days (Warsaw calendar)? */
export async function moveTrail(studentId: string, days = 7, today = dayKey()) {
  const keys: string[] = [];
  const base = new Date(today + "T12:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  const solved = await db.puzzleSolve.findMany({
    where: { studentId, puzzle: { dailyDate: { in: keys } } },
    select: { puzzle: { select: { dailyDate: true } } },
  });
  const done = new Set(solved.map((s) => s.puzzle.dailyDate));
  return keys.map((k) => ({ day: k, done: done.has(k), today: k === today }));
}
