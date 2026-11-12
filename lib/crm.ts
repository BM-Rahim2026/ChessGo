import "server-only";
import { db } from "./db";
import { dayKey } from "./format";
import { appUrl } from "./appUrl";

/** School CRM: pipeline stages, workflow checklist, golden rules and weekly KPIs. */

export const STAGES = [
  { key: "lead", label: "Lead", n: 1 },
  { key: "first_contact", label: "First contact", n: 2 },
  { key: "offer_sent", label: "Offer sent", n: 3 },
  { key: "open_day_scheduled", label: "Open Day scheduled", n: 4 },
  { key: "open_day_done", label: "Open Day done", n: 5 },
  { key: "signups", label: "Parent sign-ups", n: 6 },
  { key: "active", label: "Active group", n: 7 },
  { key: "on_hold", label: "On hold", n: 0 },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as string[];
export const stageLabel = (k: string) => STAGES.find((s) => s.key === k)?.label ?? k;

export const SCHOOL_TYPES = [
  { key: "public", label: "Public" },
  { key: "private", label: "Private" },
  { key: "international", label: "International" },
  { key: "kindergarten", label: "Kindergarten" },
] as const;
export const ROLES = [
  { key: "principal", label: "Principal" },
  { key: "eca", label: "ECA Coordinator" },
  { key: "other", label: "Other" },
] as const;

/** Stages that need a next follow-up date ("No empty dates"). */
export const needsFollowUp = (status: string) => status !== "active" && status !== "on_hold";

/** Workflow steps, grouped in the three phases of the playbook. */
export const PHASES = [
  {
    key: "contact", title: "1. Call + Email", stages: ["lead", "first_contact", "offer_sent"],
    steps: [
      { key: "called", label: "Call the Principal or ECA Coordinator" },
      { key: "pitched", label: "Pitch a free 30-minute Chess Open Day (zero cost and hassle for the school)" },
      { key: "summary_email", label: "Send the 1-page summary email" },
    ],
  },
  {
    key: "openday", title: "2. Open Day", stages: ["open_day_scheduled", "open_day_done"],
    steps: [
      { key: "date_locked", label: "Lock in the Open Day date" },
      { key: "flyers_sent", label: "Send flyers/posters 3 days before" },
      { key: "confirmed_24h", label: "Confirm 24 hours before" },
      { key: "qr_flyers", label: "After the workshop: hand out flyers with the QR code" },
    ],
  },
  {
    key: "launch", title: "3. Sign-ups & Launch", stages: ["signups", "active"],
    steps: [
      { key: "link_shared", label: "Ask the school to share the registration link with parents" },
      { key: "room_confirmed", label: "8+ kids: confirm the room" },
      { key: "coach_confirmed", label: "Confirm the coach" },
      { key: "parents_messaged", label: "Message parents with the start date" },
    ],
  },
] as const;
export const STEP_KEYS = PHASES.flatMap((p) => p.steps.map((s) => s.key)) as string[];

export const WEEKLY_TARGETS = { callsMin: 60, callsMax: 80, openDaysMin: 3, openDaysMax: 4, newGroups: 2 };
export const MAX_TOUCHES = 5;
export const ON_HOLD_MONTHS = 2;

export function addDays(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function addMonths(key: string, months: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
/** Next working day (Mon–Fri) after today. */
export function nextWorkday(today = dayKey()) {
  let k = addDays(today, 1);
  while ([0, 6].includes(new Date(`${k}T12:00:00Z`).getUTCDay())) k = addDays(k, 1);
  return k;
}
/** Monday of the current week (Warsaw time). */
export function weekStart(today = dayKey()) {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((dow + 6) % 7));
}

export async function logActivity(clubId: string, leadId: string, userId: string | null, type: string, note?: string | null, status?: string | null) {
  await db.schoolActivity.create({ data: { clubId, leadId, userId, type, note: note || null, status: status ?? null } });
}

/** Calls, Open Days and new active groups this week. */
export async function weeklyKpis(clubId: string) {
  const start = weekStart();
  const since = new Date(`${addDays(start, -1)}T00:00:00Z`); // a bit earlier, filtered by Warsaw day below
  const acts = await db.schoolActivity.findMany({ where: { clubId, createdAt: { gte: since } }, select: { type: true, status: true, createdAt: true } });
  const thisWeek = acts.filter((a) => dayKey(a.createdAt) >= start);
  return {
    weekStart: start,
    calls: thisWeek.filter((a) => a.type === "call" || a.type === "no_answer").length,
    openDays: thisWeek.filter((a) => a.type === "status" && a.status === "open_day_done").length,
    newGroups: thisWeek.filter((a) => a.type === "status" && a.status === "active").length,
  };
}

export function registrationLink(slug: string, leadId: string) {
  return `${appUrl()}/c/${slug}/register?school=${leadId}`;
}

/** Polish 1-page summary email offering a free Chess Open Day. */
export function offerEmail(o: { clubName: string; contactName?: string | null; schoolName: string; senderName: string; phone?: string | null; site: string }) {
  const hello = o.contactName ? `Dzień dobry Pani/Panie ${o.contactName.split(" ").slice(-1)[0]},` : "Dzień dobry,";
  return {
    subject: `Bezpłatny Dzień Otwarty Szachów dla ${o.schoolName}`,
    text: `${hello}

dziękuję za rozmowę. Zgodnie z ustaleniami przesyłam krótkie podsumowanie.

Proponujemy bezpłatny, 30-minutowy Dzień Otwarty Szachów w ${o.schoolName}:
- prowadzi go nasz doświadczony trener, w sali i terminie wygodnym dla szkoły,
- szkoła nie ponosi żadnych kosztów ani obowiązków organizacyjnych,
- po warsztacie dzieci dostają ulotki z kodem QR do zapisu na zajęcia,
- gdy zapisze się co najmniej 8 dzieci, uruchamiamy stałą grupę szachową w szkole (raz w tygodniu, na miejscu).

Dlaczego szachy? Uczą koncentracji, logicznego myślenia, cierpliwości i radzenia sobie z porażką — a dzieci po prostu je uwielbiają.

Czy możemy umówić termin Dnia Otwartego? Wystarczy odpowiedzieć na tę wiadomość lub zadzwonić${o.phone ? `: ${o.phone}` : ""}.

Pozdrawiam serdecznie,
${o.senderName}
${o.clubName}
${o.site}`,
  };
}
