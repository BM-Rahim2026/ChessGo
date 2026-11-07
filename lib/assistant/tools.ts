import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { Chess } from "chess.js";
import { db } from "../db";
import { dayKey, monthKey } from "../format";
import { setXp } from "../gamification";
import { playMoves } from "./chess";
import { LICHESS_DIFFICULTY, LICHESS_THEMES, fetchLichessPuzzle, type ImportedPuzzle } from "./lichess";

/**
 * Tools the admin assistant can use. Every tool is scoped to the admin's own club.
 * Deliberately no deletes and no outgoing emails: the assistant reads data and creates
 * things the admin can review (and remove) in the panel.
 */

type Ctx = { clubId: string; userId: string };
type Input = Record<string, unknown>;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "club_overview",
    description: "Key numbers for the club right now: active students, groups, this month's revenue and unpaid payment requests, open sign-ups, today's date. Call this first when the admin asks a general question about the club.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_groups",
    description: "All groups with level, age range, capacity, number of active students, monthly fee, coach and weekly schedule.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_students",
    description: "Find students. Returns id, name, group, status, XP, birth date and parents' contact details. Use query to search by student or parent name.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of a student's or parent's name (optional)." },
        group: { type: "string", description: "Group name (optional)." },
        status: { type: "string", enum: ["active", "inactive", "all"], description: "Default: active." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "student_details",
    description: "Everything about one student: group, XP, badges, attendance totals, last 6 payment requests, parents.",
    input_schema: {
      type: "object",
      properties: { studentId: { type: "string" } },
      required: ["studentId"],
      additionalProperties: false,
    },
  },
  {
    name: "attendance_report",
    description: "Attendance per student between two dates (inclusive), optionally for one group. Returns present/late/absent/excused counts and the attendance rate.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        group: { type: "string", description: "Group name (optional)." },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "payments_status",
    description: "Tuition payment requests for a month (YYYY-MM, default current month): who paid, who has not, overdue ones, totals.",
    input_schema: {
      type: "object",
      properties: { period: { type: "string", description: "YYYY-MM (optional)." } },
      additionalProperties: false,
    },
  },
  {
    name: "list_signups",
    description: "Trial and registration requests from the public website (the 'Zgłoszenia' inbox).",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", enum: ["open", "converted", "archived", "all"], description: "Default: open." } },
      additionalProperties: false,
    },
  },
  {
    name: "list_puzzles",
    description: "Existing club puzzles (newest first) with FEN, solution, rating and daily date, so you can avoid duplicates and see which days already have a daily puzzle.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", description: "Default 20, max 100." } },
      additionalProperties: false,
    },
  },
  {
    name: "check_chess_position",
    description: "Validate a chess position and optionally play a sequence of moves from it. Returns whether the FEN is legal, whose move it is, whether each move is legal, and whether the final position is check, checkmate or stalemate, plus the legal moves there. ALWAYS use this to verify a puzzle before creating it; never guess.",
    input_schema: {
      type: "object",
      properties: {
        fen: { type: "string" },
        moves: { type: "string", description: "Optional space-separated moves in English SAN (e.g. 'Qh5 Nf6 Qxf7#')." },
      },
      required: ["fen"],
      additionalProperties: false,
    },
  },
  {
    name: "find_lichess_puzzles",
    description: "Fetch real, verified puzzles from the Lichess puzzle database (public domain, millions of rated puzzles) by theme and difficulty. Returns candidates with FEN, solution in English SAN, rating and themes. Prefer this when the admin wants puzzles from a database or many reliable puzzles; then create the chosen ones with create_puzzle (give them a Polish title and hint). Puzzles already in the club are skipped.",
    input_schema: {
      type: "object",
      properties: {
        theme: { type: "string", enum: [...LICHESS_THEMES], description: "Puzzle theme, e.g. mateIn1, mateIn2, fork, pin." },
        difficulty: { type: "string", enum: [...LICHESS_DIFFICULTY], description: "Relative to an average player; for young beginners use easiest." },
        count: { type: "integer", description: "1–5, default 3." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_puzzle",
    description: "Create a club puzzle. The FEN and solution are validated; the first solution move is what students must find. Optionally schedule it as the daily puzzle for a date (replaces any puzzle already set for that date).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title shown to students, in Polish unless asked otherwise (e.g. 'Mat w 2 – poświęcenie hetmana')." },
        fen: { type: "string" },
        solution: { type: "string", description: "The full line in English SAN, starting with the side to move and including the opponent's replies, e.g. 'Rd8#' or 'Qxh7+ Kxh7 Rh3#'. Students play every move of their side; the replies are played automatically. Any checkmating move is also accepted." },
        hint: { type: "string", description: "Optional hint for students (Polish)." },
        rating: { type: "integer", description: "Difficulty 400–2500. Beginners ~600–900." },
        dailyDate: { type: "string", description: "Optional YYYY-MM-DD to make it that day's daily puzzle." },
      },
      required: ["title", "fen", "solution"],
      additionalProperties: false,
    },
  },
  {
    name: "create_news_post",
    description: "Publish (or save as draft) a news post on the public club page.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string", description: "Plain text, paragraphs separated by blank lines." },
        published: { type: "boolean", description: "false = save as draft. Default false; publish only if the admin asked to." },
      },
      required: ["title", "body"],
      additionalProperties: false,
    },
  },
  {
    name: "award_bonus_xp",
    description: "Give a student bonus XP (1–100) with a reason, e.g. for good sportsmanship or a tournament result.",
    input_schema: {
      type: "object",
      properties: { studentId: { type: "string" }, amount: { type: "integer" }, reason: { type: "string" } },
      required: ["studentId", "amount", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "create_group",
    description: "Create a new group (without schedule slots; the admin adds times in 'Grupy i plan zajęć').",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        level: { type: "string" },
        ageRange: { type: "string", description: "e.g. '6–8'" },
        capacity: { type: "integer" },
        monthlyFee: { type: "number", description: "Monthly fee in the club currency (e.g. 180 for 180 zł)." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "create_tournament",
    description: "Create a club tournament (players are added on the tournament page).",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, rounds: { type: "integer", description: "Default 5." } },
      required: ["name", "date"],
      additionalProperties: false,
    },
  },
];

/** Short Polish labels for the activity chips in the chat. */
export const TOOL_LABELS: Record<string, string> = {
  club_overview: "Sprawdzam dane klubu",
  list_groups: "Przeglądam grupy",
  list_students: "Szukam uczniów",
  student_details: "Sprawdzam ucznia",
  attendance_report: "Liczę frekwencję",
  payments_status: "Sprawdzam płatności",
  list_signups: "Przeglądam zgłoszenia",
  list_puzzles: "Przeglądam zadania",
  check_chess_position: "Sprawdzam pozycję na szachownicy",
  find_lichess_puzzles: "Szukam zadań w bazie Lichess",
  create_puzzle: "Tworzę zadanie",
  create_news_post: "Tworzę aktualność",
  award_bonus_xp: "Przyznaję XP",
  create_group: "Tworzę grupę",
  create_tournament: "Tworzę turniej",
};

export const WRITE_TOOLS = new Set(["create_puzzle", "create_news_post", "award_bonus_xp", "create_group", "create_tournament"]);

class ToolError extends Error {}

// ── input helpers (inputs come from the model: validate everything) ──
const s = (i: Input, k: string, max = 2000, required = false): string | undefined => {
  const v = i[k];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolError(`Missing required field "${k}".`);
    return undefined;
  }
  if (typeof v !== "string") throw new ToolError(`Field "${k}" must be a string.`);
  return v.trim().slice(0, max);
};
const n = (i: Input, k: string, min: number, max: number, def?: number): number | undefined => {
  const v = i[k];
  if (v === undefined || v === null || v === "") return def;
  const num = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(num)) throw new ToolError(`Field "${k}" must be a number.`);
  if (num < min || num > max) throw new ToolError(`Field "${k}" must be between ${min} and ${max}.`);
  return num;
};
const date = (v: string | undefined, k: string) => {
  if (v === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) throw new ToolError(`Field "${k}" must be YYYY-MM-DD.`);
  return v;
};
const zl = (cts: number) => Math.round(cts) / 100;

async function groupId(clubId: string, name: string | undefined) {
  if (!name) return undefined;
  const g = await db.group.findFirst({ where: { clubId, name: { equals: name, mode: "insensitive" } } })
    ?? await db.group.findFirst({ where: { clubId, name: { contains: name, mode: "insensitive" } } });
  if (!g) throw new ToolError(`No group named "${name}". Use list_groups to see the names.`);
  return g.id;
}
async function student(clubId: string, id: string) {
  const st = await db.student.findFirst({ where: { id, clubId } });
  if (!st) throw new ToolError(`No student with id "${id}" in this club. Use list_students to find the id.`);
  return st;
}

function describe(chess: Chess) {
  return {
    sideToMove: chess.turn() === "w" ? "white" : "black",
    check: chess.inCheck(),
    checkmate: chess.isCheckmate(),
    stalemate: chess.isStalemate(),
    legalMoves: chess.moves(),
    ascii: chess.ascii(),
  };
}

export async function runTool(ctx: Ctx, name: string, input: Input): Promise<{ result: unknown; link?: string }> {
  const { clubId } = ctx;
  switch (name) {
    case "club_overview": {
      const period = monthKey(new Date());
      const [club, active, groups, open, invoices] = await Promise.all([
        db.club.findUnique({ where: { id: clubId }, select: { name: true, currency: true } }),
        db.student.count({ where: { clubId, status: "active" } }),
        db.group.count({ where: { clubId } }),
        db.formSubmission.count({ where: { clubId, status: { in: ["new", "contacted"] } } }),
        db.feeInvoice.findMany({ where: { clubId, period }, select: { amountCts: true, paidAt: true, dueDate: true } }),
      ]);
      const now = new Date();
      return {
        result: {
          club: club?.name, currency: club?.currency, today: dayKey(), currentMonth: period,
          activeStudents: active, groups, openSignups: open,
          thisMonth: {
            requests: invoices.length,
            paid: zl(invoices.filter((i) => i.paidAt).reduce((a, i) => a + i.amountCts, 0)),
            unpaid: zl(invoices.filter((i) => !i.paidAt).reduce((a, i) => a + i.amountCts, 0)),
            overdueCount: invoices.filter((i) => !i.paidAt && i.dueDate < now).length,
          },
        },
      };
    }
    case "list_groups": {
      const groups = await db.group.findMany({
        where: { clubId }, orderBy: { name: "asc" },
        include: { coach: { select: { name: true } }, slots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }, _count: { select: { students: { where: { status: "active" } } } } },
      });
      const WD = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
      return {
        result: groups.map((g) => ({
          name: g.name, level: g.level, ageRange: g.ageRange, activeStudents: g._count.students, capacity: g.capacity,
          monthlyFee: zl(g.monthlyFeeCts), coach: g.coach?.name ?? null, public: g.isPublic,
          schedule: g.slots.map((sl) => `${WD[sl.weekday]} ${sl.startTime}–${sl.endTime}${sl.location ? ` (${sl.location})` : ""}`),
        })),
      };
    }
    case "list_students": {
      const q = s(input, "query", 80);
      const status = s(input, "status", 10) ?? "active";
      const gid = await groupId(clubId, s(input, "group", 80));
      const students = await db.student.findMany({
        where: {
          clubId,
          ...(status === "all" ? {} : { status }),
          ...(gid ? { groupId: gid } : {}),
          ...(q ? { OR: [
            { firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } },
            { parents: { some: { parent: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } } } },
          ] } : {}),
        },
        include: { group: { select: { name: true } }, parents: { include: { parent: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 200,
      });
      return {
        result: students.map((st) => ({
          id: st.id, name: `${st.firstName} ${st.lastName}`, group: st.group?.name ?? null, status: st.status, xp: st.xp,
          birthDate: st.birthDate ? dayKey(st.birthDate) : null,
          parents: st.parents.map(({ parent: p }) => ({ name: `${p.firstName} ${p.lastName}`, email: p.email, phone: p.phone })),
        })),
      };
    }
    case "student_details": {
      const st = await student(clubId, s(input, "studentId", 60, true)!);
      const [full, att] = await Promise.all([
        db.student.findUnique({
          where: { id: st.id },
          include: { group: true, badges: { include: { badge: true } }, parents: { include: { parent: true } }, feeInvoices: { orderBy: { period: "desc" }, take: 6 } },
        }),
        db.attendance.groupBy({ by: ["status"], where: { studentId: st.id }, _count: true }),
      ]);
      const counts = Object.fromEntries(att.map((a) => [a.status, a._count]));
      const total = att.reduce((a, r) => a + r._count, 0);
      return {
        result: {
          id: st.id, name: `${st.firstName} ${st.lastName}`, group: full?.group?.name ?? null, status: st.status, xp: st.xp,
          streak: st.streak, joined: dayKey(st.joinedAt), notes: st.notes,
          badges: full?.badges.map((b) => b.badge.name) ?? [],
          attendance: { ...counts, total, rate: total ? Math.round((((counts.present ?? 0) + (counts.late ?? 0)) / total) * 100) + "%" : null },
          payments: full?.feeInvoices.map((f) => ({ period: f.period, amount: zl(f.amountCts), paid: Boolean(f.paidAt), due: dayKey(f.dueDate) })) ?? [],
          parents: full?.parents.map(({ parent: p }) => ({ name: `${p.firstName} ${p.lastName}`, email: p.email, phone: p.phone })) ?? [],
        },
        link: `/admin/students/${st.id}`,
      };
    }
    case "attendance_report": {
      const from = date(s(input, "from", 10, true), "from")!;
      const to = date(s(input, "to", 10, true), "to")!;
      const gid = await groupId(clubId, s(input, "group", 80));
      const rows = await db.attendance.findMany({
        where: { lesson: { group: { clubId }, ...(gid ? { groupId: gid } : {}), date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } } },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      });
      const per = new Map<string, { name: string; present: number; late: number; absent: number; excused: number }>();
      for (const r of rows) {
        const k = r.student.id;
        const e = per.get(k) ?? { name: `${r.student.firstName} ${r.student.lastName}`, present: 0, late: 0, absent: 0, excused: 0 };
        if (r.status in e) (e as unknown as Record<string, number>)[r.status]++;
        per.set(k, e);
      }
      const lessons = await db.lesson.count({ where: { group: { clubId }, ...(gid ? { groupId: gid } : {}), date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } } });
      return {
        result: {
          from, to, lessons,
          students: [...per.values()].map((e) => {
            const t = e.present + e.late + e.absent + e.excused;
            return { ...e, rate: t ? Math.round(((e.present + e.late) / t) * 100) + "%" : null };
          }).sort((a, b) => a.name.localeCompare(b.name, "pl")),
        },
      };
    }
    case "payments_status": {
      const period = s(input, "period", 7) ?? monthKey(new Date());
      if (!/^\d{4}-\d{2}$/.test(period)) throw new ToolError(`"period" must be YYYY-MM.`);
      const inv = await db.feeInvoice.findMany({ where: { clubId, period }, include: { student: { select: { firstName: true, lastName: true } } }, orderBy: { dueDate: "asc" } });
      const now = new Date();
      return {
        result: {
          period,
          totals: {
            requests: inv.length,
            paid: zl(inv.filter((i) => i.paidAt).reduce((a, i) => a + i.amountCts, 0)),
            unpaid: zl(inv.filter((i) => !i.paidAt).reduce((a, i) => a + i.amountCts, 0)),
          },
          unpaid: inv.filter((i) => !i.paidAt).map((i) => ({ student: `${i.student.firstName} ${i.student.lastName}`, amount: zl(i.amountCts), due: dayKey(i.dueDate), overdue: i.dueDate < now, sent: Boolean(i.sentAt) })),
          paidCount: inv.filter((i) => i.paidAt).length,
        },
        link: "/admin/payments",
      };
    }
    case "list_signups": {
      const status = s(input, "status", 10) ?? "open";
      const where = status === "open" ? { status: { in: ["new", "contacted"] } } : status === "all" ? {} : { status };
      const subs = await db.formSubmission.findMany({ where: { clubId, ...where }, orderBy: { createdAt: "desc" }, take: 100 });
      return {
        result: subs.map((x) => ({
          kind: x.kind, status: x.status, child: `${x.childFirst} ${x.childLast}`, childBirth: x.childBirth ? dayKey(x.childBirth) : null,
          parent: `${x.parentFirst} ${x.parentLast}`, email: x.parentEmail, phone: x.parentPhone, message: x.message, received: dayKey(x.createdAt),
        })),
        link: "/admin/inbox",
      };
    }
    case "list_puzzles": {
      const limit = n(input, "limit", 1, 100, 20)!;
      const ps = await db.puzzle.findMany({ where: { clubId }, orderBy: { createdAt: "desc" }, take: limit });
      return { result: ps.map((p) => ({ title: p.title, fen: p.fen, solution: p.solution, rating: p.rating, dailyDate: p.dailyDate })) };
    }
    case "check_chess_position": {
      const fen = s(input, "fen", 120, true)!;
      const r = playMoves(fen, s(input, "moves", 400) ?? "");
      if (!r.ok) return { result: { valid: false, error: r.error } };
      return { result: { valid: true, movesPlayed: r.played, ...describe(r.chess) } };
    }
    case "find_lichess_puzzles": {
      const theme = s(input, "theme", 40);
      const difficulty = s(input, "difficulty", 10);
      if (theme && !(LICHESS_THEMES as readonly string[]).includes(theme)) throw new ToolError(`Unknown theme "${theme}".`);
      if (difficulty && !(LICHESS_DIFFICULTY as readonly string[]).includes(difficulty)) throw new ToolError(`Unknown difficulty "${difficulty}".`);
      const count = Math.trunc(n(input, "count", 1, 5, 3)!);
      const existing = new Set((await db.puzzle.findMany({ where: { clubId }, select: { fen: true } })).map((p) => p.fen));
      const found = new Map<string, ImportedPuzzle>();
      for (let attempt = 0; attempt < count * 3 && found.size < count; attempt++) {
        let p: ImportedPuzzle | null;
        try {
          p = await fetchLichessPuzzle(theme, difficulty);
        } catch (e) {
          if (found.size) break;
          throw new ToolError(`Could not reach the Lichess puzzle database (${(e as Error).message}). Design the puzzles yourself instead.`);
        }
        if (p && !existing.has(p.fen) && !found.has(p.id)) found.set(p.id, p);
      }
      return {
        result: [...found.values()].map((p) => ({ fen: p.fen, solution: p.solution.join(" "), rating: p.rating, themes: p.themes, source: p.url })),
      };
    }
    case "create_puzzle": {
      const title = s(input, "title", 120, true)!;
      const fen = s(input, "fen", 120, true)!;
      const r = playMoves(fen, s(input, "solution", 400, true)!);
      if (!r.ok) throw new ToolError(`Puzzle not created. ${r.error}`);
      if (r.played.length === 0) throw new ToolError("Puzzle not created: the solution has no moves.");
      const dailyDate = date(s(input, "dailyDate", 10), "dailyDate");
      const rating = n(input, "rating", 400, 2500, 1000)!;
      if (dailyDate) await db.puzzle.updateMany({ where: { clubId, dailyDate }, data: { dailyDate: null } });
      const p = await db.puzzle.create({
        data: { clubId, title, fen: new Chess(fen).fen(), solution: r.played.join(" "), hint: s(input, "hint", 300) ?? null, rating: Math.round(rating), dailyDate: dailyDate ?? null },
      });
      return {
        result: { created: true, id: p.id, solution: p.solution, endsInCheckmate: r.chess.isCheckmate(), dailyDate: p.dailyDate, testPage: `/admin/puzzles/${p.id}` },
        link: `/admin/puzzles/${p.id}`,
      };
    }
    case "create_news_post": {
      const post = await db.newsPost.create({
        data: { clubId, title: s(input, "title", 160, true)!, body: s(input, "body", 8000, true)!, published: input.published === true },
      });
      return { result: { created: true, id: post.id, published: post.published }, link: "/admin/club" };
    }
    case "award_bonus_xp": {
      const st = await student(clubId, s(input, "studentId", 60, true)!);
      const amount = Math.trunc(n(input, "amount", 1, 100)!);
      const reason = s(input, "reason", 200, true)!;
      await setXp({ clubId, studentId: st.id, sourceKey: null, amount, reason: "bonus", note: reason, awardedById: ctx.userId });
      return { result: { awarded: amount, student: `${st.firstName} ${st.lastName}` }, link: `/admin/students/${st.id}` };
    }
    case "create_group": {
      const name = s(input, "name", 80, true)!;
      if (await db.group.findFirst({ where: { clubId, name: { equals: name, mode: "insensitive" } } })) throw new ToolError(`A group named "${name}" already exists.`);
      const g = await db.group.create({
        data: {
          clubId, name, level: s(input, "level", 60) ?? null, ageRange: s(input, "ageRange", 20) ?? null,
          capacity: Math.trunc(n(input, "capacity", 1, 100, 12)!), monthlyFeeCts: Math.round((n(input, "monthlyFee", 0, 100000, 0) ?? 0) * 100),
        },
      });
      return { result: { created: true, id: g.id, name: g.name }, link: "/admin/groups" };
    }
    case "create_tournament": {
      const d = date(s(input, "date", 10, true), "date")!;
      const tour = await db.tournament.create({ data: { clubId, name: s(input, "name", 120, true)!, date: new Date(`${d}T12:00:00Z`), rounds: Math.trunc(n(input, "rounds", 1, 15, 5)!) } });
      return { result: { created: true, id: tour.id }, link: `/admin/tournaments/${tour.id}` };
    }
    default:
      throw new ToolError(`Unknown tool "${name}".`);
  }
}

export { ToolError, playMoves };
