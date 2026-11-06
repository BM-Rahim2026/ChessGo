import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { hashPassword } from "./auth";

export function tempPassword() {
  return randomBytes(6).toString("base64url");
}

/** Find or create a club parent by email, so the same parent is reused for siblings. */
export async function findOrCreateParent(clubId: string, p: { firstName: string; lastName: string; email: string; phone?: string | null }) {
  const email = p.email.toLowerCase().trim();
  const existing = await db.parent.findFirst({ where: { clubId, email } });
  if (existing) {
    if (p.phone && !existing.phone) await db.parent.update({ where: { id: existing.id }, data: { phone: p.phone } });
    return existing;
  }
  return db.parent.create({ data: { clubId, firstName: p.firstName, lastName: p.lastName, email, phone: p.phone ?? null } });
}

/** Create a login for a parent or student. Returns the temporary password, or null if the email is taken. */
export async function createLogin(opts: { clubId: string; email: string; name: string; role: "parent" | "student" | "coach" | "club_admin"; password?: string }) {
  const email = opts.email.toLowerCase().trim();
  if (await db.user.findUnique({ where: { email } })) return null;
  const password = opts.password || tempPassword();
  const user = await db.user.create({ data: { email, name: opts.name, role: opts.role, clubId: opts.clubId, passwordHash: await hashPassword(password) } });
  return { user, password };
}
