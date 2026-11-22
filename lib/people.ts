import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { hashPassword } from "./auth";
import { phoneDigits } from "./format";

/** How an account signs in: its email, or its phone number. */
export const loginName = (u: { email: string | null; phone: string | null }) => u.email ?? (u.phone ? `tel. ${u.phone}` : "—");

export function tempPassword() {
  return randomBytes(6).toString("base64url");
}

/**
 * Find or create a club parent, so the same parent is reused for siblings.
 * Matched by email when given, otherwise by phone number (email is optional).
 */
export async function findOrCreateParent(clubId: string, p: { firstName: string; lastName: string; email?: string | null; phone?: string | null }) {
  const email = p.email?.toLowerCase().trim() || null;
  const phone = p.phone?.trim() || null;
  let existing = email ? await db.parent.findFirst({ where: { clubId, email } }) : null;
  if (!existing && phone) {
    const digits = phoneDigits(phone);
    const candidates = await db.parent.findMany({ where: { clubId, phone: { not: null } } });
    existing = candidates.find((c) => phoneDigits(c.phone) === digits && (!email || !c.email)) ?? null;
  }
  if (existing) {
    const fill: { phone?: string; email?: string } = {};
    if (phone && !existing.phone) fill.phone = phone;
    if (email && !existing.email) fill.email = email;
    if (Object.keys(fill).length) existing = await db.parent.update({ where: { id: existing.id }, data: fill });
    return existing;
  }
  return db.parent.create({ data: { clubId, firstName: p.firstName, lastName: p.lastName, email, phone } });
}

/**
 * Create a login. It signs in with the email and/or the phone number (at least one is needed).
 * Returns the temporary password, or null if the email or phone already has a login.
 */
export async function createLogin(opts: { clubId: string; email?: string | null; phone?: string | null; name: string; role: "parent" | "student" | "coach" | "club_admin"; password?: string }) {
  const email = opts.email?.toLowerCase().trim() || null;
  const digits = opts.phone ? phoneDigits(opts.phone) : "";
  const phone = digits.length >= 9 ? digits : null;
  if (!email && !phone) return null;
  if (email && (await db.user.findUnique({ where: { email } }))) return null;
  if (!email && phone && (await db.user.findUnique({ where: { phone } }))) return null;
  // With an email the phone is a bonus: skip it if another account already uses it.
  const phoneFree = phone && !(await db.user.findUnique({ where: { phone } })) ? phone : null;
  const password = opts.password || tempPassword();
  const user = await db.user.create({ data: { email, phone: phoneFree, name: opts.name, role: opts.role, clubId: opts.clubId, passwordHash: await hashPassword(password), mustChangePassword: true } });
  return { user, password };
}

/** Give a club member a new temporary password (they must change it at next sign-in). */
export async function resetLogin(clubId: string, userId: string) {
  const user = await db.user.findFirst({ where: { id: userId, clubId, role: { not: "platform_admin" } } });
  if (!user) return null;
  const password = tempPassword();
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } });
  await db.authSession.deleteMany({ where: { userId: user.id } });
  return { user, password };
}
