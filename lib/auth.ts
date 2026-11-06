import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import type { Role } from "./types";

const COOKIE = "cg_session";
const TTL_MS = 30 * 24 * 3600 * 1000;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function login(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
  const id = randomBytes(32).toString("hex");
  await db.authSession.create({ data: { id, userId: user.id, expiresAt: new Date(Date.now() + TTL_MS) } });
  (await cookies()).set(COOKIE, id, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000,
  });
  return user;
}

export async function logout() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.authSession.deleteMany({ where: { id } });
  jar.delete(COOKIE);
}

export async function currentUser() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  const s = await db.authSession.findUnique({ where: { id }, include: { user: { include: { club: true } } } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!roles.includes(u.role as Role)) redirect(homeFor(u.role as Role));
  return u;
}

/** Staff of a club: returns user plus a guaranteed clubId. */
export async function requireStaff(adminOnly = false) {
  const u = await requireRole(...((adminOnly ? ["club_admin"] : ["club_admin", "coach"]) as Role[]));
  if (!u.clubId || !u.club) redirect("/login");
  return { user: u, clubId: u.clubId, club: u.club };
}

export function homeFor(role: Role | string) {
  switch (role) {
    case "platform_admin": return "/platform";
    case "club_admin":
    case "coach": return "/admin";
    default: return "/portal";
  }
}
