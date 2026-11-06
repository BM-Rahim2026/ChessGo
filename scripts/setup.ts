// One-time production setup. Creates (or updates) the platform admin and, optionally, your first club + its admin.
// Never deletes anything, so it is safe to run again.
//
//   npm run setup -- --platform-email you@example.com --platform-name "Your Name" \
//                    --club-name "ChessGo Academy" --club-slug chessgo \
//                    --club-admin-email club@example.com --club-admin-name "Your Name"
//
// Passwords are generated and printed once; each person must change theirs at first sign-in.
// Platform admin and club admin need different email addresses (one login = one role).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { DEFAULT_BADGES } from "../lib/badges";
import { trialEnd } from "../lib/billing";

const db = new PrismaClient();
const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] ?? ""]] : acc), []),
);
const temp = () => randomBytes(9).toString("base64url");

async function upsertUser(email: string, name: string, role: string, clubId: string | null) {
  email = email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== role || existing.clubId !== clubId) throw new Error(`${email} already exists with role ${existing.role}. Use a different email.`);
    console.log(`= ${role} ${email} already exists (password unchanged)`);
    return;
  }
  const password = temp();
  await db.user.create({ data: { email, name, role, clubId, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
  console.log(`+ ${role} ${email}  temporary password: ${password}`);
}

async function main() {
  if (!args["platform-email"]) {
    console.error("Missing --platform-email. See the comment at the top of scripts/setup.ts.");
    process.exit(1);
  }
  await upsertUser(args["platform-email"], args["platform-name"] || "Platform Admin", "platform_admin", null);

  if (args["club-slug"]) {
    const slug = args["club-slug"].toLowerCase().replace(/[^a-z0-9-]/g, "-");
    let club = await db.club.findUnique({ where: { slug } });
    if (!club) {
      // Your own academy: no trial needed, mark as active.
      club = await db.club.create({ data: { slug, name: args["club-name"] || slug, trialEndsAt: args["trial"] === "yes" ? trialEnd(new Date()) : new Date(), billingStatus: args["trial"] === "yes" ? "trial" : "active" } });
      console.log(`+ club ${club.name} → /c/${slug}`);
    } else console.log(`= club ${club.name} already exists`);
    for (const b of DEFAULT_BADGES) await db.badge.upsert({ where: { clubId_code: { clubId: club.id, code: b.code } }, update: {}, create: { ...b, clubId: club.id } });
    if (args["club-admin-email"]) await upsertUser(args["club-admin-email"], args["club-admin-name"] || "Club Admin", "club_admin", club.id);
  }
  console.log("\nDone. Save these passwords now; they are not shown again.");
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
