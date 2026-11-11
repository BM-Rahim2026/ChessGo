import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { hashPassword } from "./auth";

/**
 * One demo family per club (a child + a parent, both with logins) so the admin can see the
 * student and parent panels. The child is "inactive" so it is not billed or sent payment requests.
 */
const emails = (slug: string) => ({
  parent: `demo.rodzic+${slug}@chessgo.pl`,
  student: `demo.uczen+${slug}@chessgo.pl`,
});

async function upsertLogin(clubId: string, email: string, name: string, role: "parent" | "student", passwordHash: string) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.clubId !== clubId) throw new Error("demo email belongs to another club");
    await db.authSession.deleteMany({ where: { userId: existing.id } });
    return db.user.update({ where: { id: existing.id }, data: { passwordHash, mustChangePassword: false, name } });
  }
  return db.user.create({ data: { email, name, role, clubId, passwordHash, mustChangePassword: false } });
}

/** Create the demo family, or reset its passwords if it exists. Returns the logins. */
export async function ensureDemoFamily(clubId: string) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  const e = emails(club.slug);
  const password = "Demo-" + randomBytes(4).toString("hex");
  const hash = await hashPassword(password);

  const studentUser = await upsertLogin(clubId, e.student, "Demo Uczeń", "student", hash);
  const parentUser = await upsertLogin(clubId, e.parent, "Demo Rodzic", "parent", hash);

  let student = await db.student.findUnique({ where: { userId: studentUser.id } });
  if (!student) {
    const group = await db.group.findFirst({ where: { clubId }, orderBy: { name: "asc" } });
    student = await db.student.create({
      data: { clubId, userId: studentUser.id, firstName: "Demo", lastName: "Uczeń", groupId: group?.id ?? null, status: "inactive", notes: "Konto demonstracyjne do testów (bez opłat)." },
    });
  }
  let parent = await db.parent.findFirst({ where: { clubId, email: e.parent } });
  if (!parent) parent = await db.parent.create({ data: { clubId, firstName: "Demo", lastName: "Rodzic", email: e.parent, phone: "500 000 000", userId: parentUser.id } });
  else if (parent.userId !== parentUser.id) await db.parent.update({ where: { id: parent.id }, data: { userId: parentUser.id } });
  await db.studentParent.upsert({
    where: { studentId_parentId: { studentId: student.id, parentId: parent.id } }, update: {}, create: { studentId: student.id, parentId: parent.id },
  });
  return { parentEmail: e.parent, studentEmail: e.student, password, studentId: student.id };
}

/** Remove the demo family completely. */
export async function removeDemoFamily(clubId: string) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  const e = emails(club.slug);
  const users = await db.user.findMany({ where: { clubId, email: { in: [e.parent, e.student] } } });
  await db.$transaction([
    db.student.deleteMany({ where: { clubId, userId: { in: users.map((u) => u.id) } } }),
    db.parent.deleteMany({ where: { clubId, email: e.parent } }),
    db.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } }),
  ]);
}

export async function demoExists(clubId: string) {
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  return Boolean(await db.user.findUnique({ where: { email: emails(club.slug).student } }));
}
