// DEMO data only. Run: npm run db:seed. It WIPES the whole database first.
// For your real academy use `npm run setup` instead (see README).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DAY = 86400000;
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const dk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const FIRST = ["Lena", "Noah", "Mia", "Elias", "Emma", "Leon", "Sofia", "Luca", "Hanna", "Paul", "Ella", "Ben", "Lina", "Finn", "Mila", "Jonas", "Clara", "Theo", "Ida", "Max", "Nora", "Felix", "Amelie", "Anton", "Lea", "Emil", "Marie", "Oskar", "Frieda", "Karl", "Sara", "Adam", "Zoe", "Liam", "Maya", "Leo"];
const LAST = ["Müller", "Schmidt", "Novak", "Rossi", "Kovač", "Dubois", "Jansen", "Horvat", "Silva", "Weber", "Fischer", "Meyer", "Wagner", "Becker", "Haddad", "Petrov", "Nowak", "Costa"];

async function wipe() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url) && !process.argv.includes("--yes-wipe-everything")) {
    console.error("Refusing to wipe a non-local database. This seed deletes ALL data.\nIf you really mean it: npm run db:seed -- --yes-wipe-everything");
    process.exit(1);
  }
  const tables = ["OrderLine", "Order", "ShopVariant", "ShopItem", "FormSubmission", "NewsPost", "TournamentGame", "TournamentEntry", "Tournament", "StudentBadge", "Badge", "XpEvent", "PuzzleSolve", "Puzzle", "FeeInvoice", "Attendance", "Lesson", "StudentParent", "Parent", "Student", "ScheduleSlot", "Group", "PasswordResetToken", "AuthSession", "User", "PlatformInvoice", "Club"];
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

async function main() {
  await wipe();
  const pw = await bcrypt.hash("chessgo123", 10);
  const now = new Date();

  await db.user.create({ data: { email: "platform@chessgo.app", name: "Platform Admin", role: "platform_admin", passwordHash: pw } });

  const club = await db.club.create({
    data: {
      slug: "chessgo", name: "ChessGo Academy", currency: "pln",
      description: "Chess lessons for kids aged 5–16, from first moves to tournament play. Small groups, friendly coaches, and a lot of puzzles.",
      address: "Schachstraße 12, Berlin", email: "hello@chessgo.app", phone: "+49 30 1234567",
      createdAt: new Date(now.getTime() - 200 * DAY), trialEndsAt: new Date(now.getTime() - 170 * DAY), billingStatus: "active",
    },
  });
  await db.club.create({ data: { slug: "knights-corner", name: "Knight's Corner", trialEndsAt: new Date(now.getTime() + 18 * DAY), createdAt: new Date(now.getTime() - 12 * DAY) } });

  const admin = await db.user.create({ data: { email: "admin@chessgo.app", name: "Lina Admin", role: "club_admin", clubId: club.id, passwordHash: pw, bio: "Founder and head coach, FIDE trainer." } });
  const coachA = await db.user.create({ data: { email: "coach@chessgo.app", name: "Marko Petrović", role: "coach", clubId: club.id, passwordHash: pw, bio: "FIDE Master, 10 years of teaching juniors." } });
  const coachB = await db.user.create({ data: { email: "anna@chessgo.app", name: "Anna Weiss", role: "coach", clubId: club.id, passwordHash: pw, bio: "Women's national team player, loves endgames." } });

  const groupDefs = [
    { name: "Little Pawns", level: "Beginner", ageRange: "5–7", capacity: 10, fee: 4500, coach: coachB.id, slots: [[2, "16:00", "17:00"], [4, "16:00", "17:00"]] },
    { name: "Knights", level: "Beginner+", ageRange: "8–10", capacity: 12, fee: 5500, coach: coachA.id, slots: [[1, "17:00", "18:30"], [3, "17:00", "18:30"]] },
    { name: "Bishops", level: "Intermediate", ageRange: "10–13", capacity: 12, fee: 6000, coach: coachA.id, slots: [[2, "17:30", "19:00"], [5, "17:00", "18:30"]] },
    { name: "Tournament Squad", level: "Advanced", ageRange: "12–16", capacity: 8, fee: 7500, coach: admin.id, slots: [[6, "10:00", "12:30"]] },
  ];
  const groups: { id: string }[] = [];
  for (const g of groupDefs) {
    groups.push(await db.group.create({
      data: { clubId: club.id, name: g.name, level: g.level, ageRange: g.ageRange, capacity: g.capacity, monthlyFeeCts: g.fee, coachId: g.coach,
        slots: { create: g.slots.map(([weekday, startTime, endTime]) => ({ weekday: weekday as number, startTime: startTime as string, endTime: endTime as string, location: "Main hall" })) } },
    }));
  }

  // Students + parents
  const students: ({ id: string; firstName: string; lastName: string; joinedAt: Date; gi: number })[] = [];
  let parentIdx = 0;
  const sizes = [9, 11, 10, 7];
  for (let gi = 0; gi < groups.length; gi++) {
    for (let i = 0; i < sizes[gi]; i++) {
      const first = FIRST[(gi * 11 + i * 3) % FIRST.length], last = pick(LAST);
      const joined = new Date(now.getTime() - Math.floor(30 + rnd() * 330) * DAY);
      const s = await db.student.create({ data: { clubId: club.id, firstName: first, lastName: last, groupId: groups[gi].id, joinedAt: joined, birthDate: new Date(2010 + gi * -1 + 8 - Math.floor(rnd() * 3), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27)) } });
      const p = await db.parent.create({ data: { clubId: club.id, firstName: pick(["Julia", "Thomas", "Sandra", "Ali", "Petra", "Ivan", "Claire", "Marco"]), lastName: last, email: `parent${++parentIdx}@example.com`, phone: `+49 151 ${1000000 + parentIdx * 7919}` } });
      await db.studentParent.create({ data: { studentId: s.id, parentId: p.id } });
      students.push({ ...s, gi });
    }
  }
  // A few who left
  for (const s of students.slice(0, 40).filter((_, i) => i % 9 === 4)) {
    const left = new Date(now.getTime() - Math.floor(10 + rnd() * 100) * DAY);
    if (left > s.joinedAt) await db.student.update({ where: { id: s.id }, data: { status: "inactive", leftAt: left } });
  }

  // Demo logins: parent of first Knights student, and that student
  const demoKid = students.find((s) => s.gi === 1)!;
  const demoParent = await db.parent.findFirstOrThrow({ where: { children: { some: { studentId: demoKid.id } } } });
  const pu = await db.user.create({ data: { email: "parent@chessgo.app", name: `${demoParent.firstName} ${demoParent.lastName}`, role: "parent", clubId: club.id, passwordHash: pw } });
  await db.parent.update({ where: { id: demoParent.id }, data: { userId: pu.id, email: "parent@chessgo.app" } });
  const su = await db.user.create({ data: { email: "student@chessgo.app", name: `${demoKid.firstName} ${demoKid.lastName}`, role: "student", clubId: club.id, passwordHash: pw } });
  await db.student.update({ where: { id: demoKid.id }, data: { userId: su.id } });

  const xp = new Map<string, number>();
  const addXp = async (studentId: string, amount: number, reason: string, sourceKey: string | null, createdAt: Date, note?: string) => {
    await db.xpEvent.create({ data: { clubId: club.id, studentId, amount, reason, sourceKey, createdAt, note } });
    xp.set(studentId, (xp.get(studentId) ?? 0) + amount);
  };

  // Lessons & attendance for the last ~16 weeks
  const fresh = await db.student.findMany({ where: { clubId: club.id } });
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    for (let d = 112; d >= 1; d--) {
      const date = new Date(now.getTime() - d * DAY);
      const wd = ((date.getDay() + 6) % 7) + 1;
      if (!groupDefs[gi].slots.some((s) => s[0] === wd)) continue;
      const day = new Date(dk(date) + "T00:00:00.000Z");
      const lesson = await db.lesson.create({ data: { groupId: g.id, date: day, topic: pick(["Forks", "Pins", "Opening principles", "Rook endgames", "Checkmate patterns", "Calculation", "Pawn structure"]) } });
      for (const s of fresh.filter((x) => x.groupId === g.id && x.joinedAt < date && (!x.leftAt || x.leftAt > date))) {
        const r = rnd();
        const status = r < 0.78 ? "present" : r < 0.86 ? "late" : r < 0.95 ? "absent" : "excused";
        const a = await db.attendance.create({ data: { lessonId: lesson.id, studentId: s.id, status } });
        if (status === "present" || status === "late") await addXp(s.id, status === "present" ? 10 : 5, "attendance", `att:${a.id}`, date);
      }
    }
  }

  // Puzzles: a library + daily puzzles for the past 10 days, today and next 5
  const PUZ = [
    ["Back-rank mate", "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1", "Rd8#", "The king has no escape squares.", 800],
    ["Scholar's finish", "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", "Qxf7#", "Look at f7.", 700],
    ["Knight fork", "r3k3/8/8/8/4N3/8/8/4K3 w q - 0 1", "Nd6+", "Check and attack at the same time.", 900],
    ["Smothered", "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", "Nf7#", "The king is boxed in by its own pieces.", 1100],
    ["Win the queen", "3qk3/8/8/8/8/8/8/3RK3 w - - 0 1", "Rxd8+", "Just take it!", 600],
    ["Ladder mate", "k7/8/1R6/8/8/8/8/R5K1 w - - 0 1", "Ra1", "Use both rooks.", 750],
    ["Pin to win", "4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1", "Rxe7+", "", 650],
    ["Queen sac", "5rk1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1", "Qg7#", "", 1000],
  ] as const;
  const puzzles: { id: string; dailyDate: string | null }[] = [];
  for (let i = -10; i <= 5; i++) {
    const [title, fen, solution, hint, rating] = PUZ[(i + 10) % PUZ.length];
    puzzles.push(await db.puzzle.create({ data: { clubId: club.id, title: `${title}${i === 0 ? "" : ` #${i + 11}`}`, fen, solution, hint: hint || null, rating, dailyDate: dk(new Date(now.getTime() + i * DAY)) } }));
  }
  for (const [title, fen, solution, hint, rating] of PUZ) await db.puzzle.create({ data: { clubId: club.id, title: `Practice: ${title}`, fen, solution, hint: hint || null, rating } });

  // Puzzle solves + streaks for active students
  for (const s of fresh.filter((x) => x.status === "active")) {
    const skill = rnd();
    let streak = 0, best = 0, last: string | null = null;
    for (let i = -10; i < 0; i++) {
      const p = puzzles[i + 10];
      if (rnd() < skill) {
        const when = new Date(now.getTime() + i * DAY + 3600_000 * 17);
        await db.puzzleSolve.create({ data: { puzzleId: p.id, studentId: s.id, solvedAt: when } });
        await addXp(s.id, 10, "daily_puzzle", `puz:${p.id}`, when);
        const prev = new Date(now.getTime() + (i - 1) * DAY);
        streak = last === dk(prev) ? streak + 1 : 1;
        last = p.dailyDate!;
        best = Math.max(best, streak);
        if (streak % 7 === 0) await addXp(s.id, 25, "streak_bonus", `streak:${p.dailyDate}`, when, `${streak}-day streak`);
      }
    }
    await db.student.update({ where: { id: s.id }, data: { streak, bestStreak: best, lastPuzzleDay: last } });
  }

  // Finished tournament for Bishops + Squad
  const t = await db.tournament.create({ data: { clubId: club.id, name: "Autumn Junior Open", date: new Date(now.getTime() - 20 * DAY), rounds: 3, status: "finished" } });
  const players = fresh.filter((x) => x.status === "active" && (x.groupId === groups[2].id || x.groupId === groups[3].id)).slice(0, 8);
  for (const p of players) await db.tournamentEntry.create({ data: { tournamentId: t.id, studentId: p.id } });
  const pts = new Map(players.map((p) => [p.id, 0]));
  for (let round = 1; round <= 3; round++) {
    const order = [...players].sort((a, b) => (pts.get(b.id)! - pts.get(a.id)!) || a.id.localeCompare(b.id));
    for (let i = 0; i + 1 < order.length; i += 2) {
      const [w, b] = round % 2 ? [order[i], order[i + 1]] : [order[i + 1], order[i]];
      const r = rnd(), result = r < 0.45 ? "1-0" : r < 0.8 ? "0-1" : "1/2-1/2";
      const g = await db.tournamentGame.create({ data: { tournamentId: t.id, round, whiteId: w.id, blackId: b.id, result } });
      const wPts = result === "1-0" ? 1 : result === "0-1" ? 0 : 0.5;
      pts.set(w.id, pts.get(w.id)! + wPts); pts.set(b.id, pts.get(b.id)! + 1 - wPts);
      await addXp(w.id, 5 + (wPts === 1 ? 5 : wPts === 0.5 ? 2 : 0), "tournament_game", `game:${g.id}`, t.date);
      await addXp(b.id, 5 + (wPts === 0 ? 5 : wPts === 0.5 ? 2 : 0), "tournament_game", `game:${g.id}`, t.date);
    }
  }
  const winner = [...pts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  await db.tournament.update({ where: { id: t.id }, data: { winnerId: winner } });
  await addXp(winner, 50, "tournament_win", `twin:${t.id}`, t.date, t.name);
  await db.tournament.create({ data: { clubId: club.id, name: "Winter Blitz", date: new Date(now.getTime() + 25 * DAY), rounds: 5 } });

  // Coach bonus XP
  for (const s of fresh.filter((x) => x.status === "active").slice(0, 6)) await addXp(s.id, 15, "bonus", null, new Date(now.getTime() - 3 * DAY), "Great sportsmanship");
  for (const [id, v] of xp) await db.student.update({ where: { id }, data: { xp: v } });

  // Badges + awards (thresholds match lib/gamification DEFAULT_BADGES)
  const BADGES = [
    ["sessions_10", "10 sessions", "Attended 10 lessons", "📅", "sessions", 10], ["sessions_50", "50 sessions", "Attended 50 lessons", "🏛", "sessions", 50],
    ["puzzles_10", "Puzzle starter", "Solved 10 puzzles", "🧩", "puzzles", 10], ["puzzles_50", "50 puzzles", "Solved 50 puzzles", "🧠", "puzzles", 50],
    ["streak_7", "7-day streak", "Solved the daily puzzle 7 days in a row", "🔥", "best_streak", 7],
    ["first_tournament", "First tournament", "Played in a club tournament", "♞", "tournaments", 1],
    ["tournament_winner", "Tournament winner", "Won a club tournament", "🏆", "tournament_wins", 1], ["xp_1000", "1000 XP", "Earned 1000 XP", "⭐", "xp", 1000],
  ] as const;
  for (const [code, name, description, icon, metric, threshold] of BADGES) await db.badge.create({ data: { clubId: club.id, code, name, description, icon, metric, threshold } });
  // (awards are computed by the app on first view via evaluateBadges)

  // Tuition invoices: last 4 months
  for (let m = 3; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const period = dk(d).slice(0, 7);
    const due = new Date(d.getFullYear(), d.getMonth(), 10, 23, 59);
    for (const s of await db.student.findMany({ where: { clubId: club.id, joinedAt: { lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) } }, include: { group: true } })) {
      if (s.leftAt && s.leftAt < d) continue;
      const paidRoll = rnd();
      const paid = m >= 2 ? paidRoll < 0.97 : m === 1 ? paidRoll < 0.85 : due < now ? paidRoll < 0.7 : paidRoll < 0.4;
      await db.feeInvoice.create({ data: { clubId: club.id, studentId: s.id, period, amountCts: s.group!.monthlyFeeCts, dueDate: due,
        paidAt: paid ? new Date(Math.min(now.getTime(), due.getTime() - DAY * Math.floor(rnd() * 8))) : null, method: paid ? pick(["cash", "transfer", "card"]) : null } });
    }
  }

  // News
  await db.newsPost.createMany({ data: [
    { clubId: club.id, title: "Autumn Junior Open results", body: "Congratulations to all 8 players! Full standings are in the student portal.", publishedAt: new Date(now.getTime() - 19 * DAY) },
    { clubId: club.id, title: "Winter Blitz registration open", body: "Our next club tournament is in December. Ask your coach to sign you up.", publishedAt: new Date(now.getTime() - 4 * DAY) },
  ] });

  // Shop
  const tee = await db.shopItem.create({ data: { clubId: club.id, name: "Club T-shirt", category: "tshirt", priceCts: 1800, description: "Organic cotton, ChessGo logo.",
    variants: { create: [{ label: "Kids S", stock: 6 }, { label: "Kids M", stock: 4 }, { label: "Kids L", stock: 2 }, { label: "Adult M", stock: 5 }] } }, include: { variants: true } });
  await db.shopItem.create({ data: { clubId: club.id, name: "Tournament chess set", category: "chess_set", priceCts: 3500, description: "Weighted pieces, roll-up board, bag.", variants: { create: [{ label: "Standard", stock: 8 }] } } });
  await db.shopItem.create({ data: { clubId: club.id, name: "My First Chess Book", category: "book", priceCts: 1450, variants: { create: [{ label: "English", stock: 10 }, { label: "Deutsch", stock: 7 }] } } });
  for (let i = 0; i < 4; i++) {
    const created = new Date(now.getTime() - (5 + i * 20) * DAY);
    const v = tee.variants[i % tee.variants.length];
    const paid = i !== 0;
    const parent = await db.parent.findFirstOrThrow({ where: { clubId: club.id }, skip: i * 3 });
    await db.order.create({ data: { clubId: club.id, parentId: parent.id, totalCts: 1800, paymentMethod: i % 2 ? "stripe" : "at_club", paymentStatus: paid ? "paid" : "unpaid", paidAt: paid ? created : null,
      status: i === 0 ? "pending" : i === 1 ? "ready" : "collected", createdAt: created, lines: { create: [{ variantId: v.id, name: `Club T-shirt (${v.label})`, qty: 1, unitCts: 1800 }] } } });
  }

  // Inbox
  await db.formSubmission.createMany({ data: [
    { clubId: club.id, kind: "trial", childFirst: "Yusuf", childLast: "Demir", childBirth: new Date(2017, 3, 2), parentFirst: "Elif", parentLast: "Demir", parentEmail: "elif.demir@example.com", parentPhone: "+49 160 555 0101", groupId: groups[1].id, preferredDate: dk(new Date(now.getTime() + 5 * DAY)), message: "He plays a bit with his grandfather.", consent: true },
    { clubId: club.id, kind: "registration", childFirst: "Ava", childLast: "Klein", childBirth: new Date(2019, 8, 14), parentFirst: "Moritz", parentLast: "Klein", parentEmail: "m.klein@example.com", groupId: groups[0].id, consent: true },
    { clubId: club.id, kind: "trial", childFirst: "Tom", childLast: "Berger", parentFirst: "Lisa", parentLast: "Berger", parentEmail: "lisa.b@example.com", status: "contacted", message: "Does he need his own board?", consent: true, createdAt: new Date(now.getTime() - 6 * DAY) },
  ] });

  console.log("Seeded. Logins (password chessgo123): platform@ / admin@ / coach@ / parent@ / student@chessgo.app");
}

main().finally(() => db.$disconnect());
