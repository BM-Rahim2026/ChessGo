import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "./auth";
import { db } from "./db";

export async function portalContext() {
  const user = await requireRole("parent", "student");
  if (!user.clubId || !user.club) redirect("/login");
  if (user.role === "student") {
    const student = await db.student.findUnique({ where: { userId: user.id }, include: { group: true } });
    return { user, club: user.club, student, parent: null, children: student ? [student] : [] };
  }
  const parent = await db.parent.findUnique({ where: { userId: user.id }, include: { children: { include: { student: { include: { group: true } } } } } });
  return { user, club: user.club, student: null, parent, children: parent?.children.map((c) => c.student) ?? [] };
}

export const level = (xp: number) => ({ level: Math.floor(xp / 100) + 1, into: xp % 100 });
