"use server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { setXp } from "@/lib/gamification";
import { levelById } from "@/lib/learn/levels";
import { verifyLevel } from "@/lib/learn/engine";

export type LearnSaveResult = { stars: number; saved: boolean; gained: number };

/** 2 XP per star, counted once per level (improving later tops it up to the new best). */
const XP_PER_STAR = 2;

export async function saveLearnLevel(levelId: string, moves: string[]): Promise<LearnSaveResult> {
  const level = levelById(String(levelId));
  if (!level) return { stars: 0, saved: false, gained: 0 };
  const stars = verifyLevel(level, Array.isArray(moves) ? moves.map(String).slice(0, 60) : []);
  if (!stars) return { stars: 0, saved: false, gained: 0 };
  const u = await currentUser();
  if (!u || u.role !== "student") return { stars, saved: false, gained: 0 };
  const student = await db.student.findUnique({ where: { userId: u.id } });
  if (!student) return { stars, saved: false, gained: 0 };
  const prev = await db.learnProgress.findUnique({ where: { studentId_levelId: { studentId: student.id, levelId: level.id } } });
  const best = Math.max(prev?.stars ?? 0, stars);
  if (!prev) await db.learnProgress.create({ data: { studentId: student.id, levelId: level.id, stars } });
  else if (stars > prev.stars) await db.learnProgress.update({ where: { id: prev.id }, data: { stars, completedAt: new Date() } });
  const gained = (best - (prev?.stars ?? 0)) * XP_PER_STAR;
  if (gained > 0) await setXp({ clubId: student.clubId, studentId: student.id, sourceKey: `learn:${level.id}`, amount: best * XP_PER_STAR, reason: "learn" });
  return { stars, saved: true, gained };
}
