"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { dayKey, str, optStr } from "@/lib/format";
import { sendFromPanel } from "@/lib/mail";
import {
  MAX_TOUCHES, ON_HOLD_MONTHS, ROLES, SCHOOL_TYPES, STAGE_KEYS, STEP_KEYS,
  addMonths, logActivity, needsFollowUp, nextWorkday,
} from "@/lib/crm";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const date = (v: FormDataEntryValue | null) => { const s = str(v); return DATE.test(s) ? s : null; };
const time = (v: FormDataEntryValue | null) => { const s = str(v); return TIME.test(s) ? s : null; };
const int = (v: FormDataEntryValue | null, min: number, max: number, def: number) => {
  const n = Math.trunc(Number(v)); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.min(max, Math.max(min, n)) : def;
};

async function lead(id: string) {
  const { clubId, user } = await requireStaff(true);
  const l = await db.schoolLead.findFirst({ where: { id, clubId } });
  if (!l) redirect("/admin/crm");
  return { l, clubId, user };
}

/** Fields shared by "add" and "edit". */
function fields(fd: FormData) {
  const type = str(fd.get("schoolType"));
  const role = str(fd.get("contactRole"));
  return {
    schoolName: str(fd.get("schoolName")).slice(0, 160),
    country: optStr(fd.get("country"))?.slice(0, 80) ?? "Polska",
    city: optStr(fd.get("city"))?.slice(0, 80) ?? null,
    schoolType: SCHOOL_TYPES.some((t) => t.key === type) ? type : "public",
    contactName: optStr(fd.get("contactName"))?.slice(0, 120) ?? null,
    contactRole: ROLES.some((r) => r.key === role) ? role : null,
    phone: optStr(fd.get("phone"))?.slice(0, 40) ?? null,
    whatsapp: optStr(fd.get("whatsapp"))?.slice(0, 40) ?? null,
    email: optStr(fd.get("email"))?.toLowerCase().slice(0, 160) ?? null,
  };
}

export async function addSchool(fd: FormData) {
  const { clubId, user } = await requireStaff(true);
  const f = fields(fd);
  if (!f.schoolName) redirect("/admin/crm?err=name");
  const next = date(fd.get("nextFollowUp")) ?? nextWorkday();
  const l = await db.schoolLead.create({ data: { clubId, ...f, nextFollowUp: next, notes: optStr(fd.get("notes")) } });
  await logActivity(clubId, l.id, user.id, "status", "Dodano do CRM", "lead");
  redirect(`/admin/crm/${l.id}?saved=1`);
}

export async function saveSchool(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  const f = fields(fd);
  if (!f.schoolName) redirect(`/admin/crm/${l.id}?err=name`);
  const status = STAGE_KEYS.includes(str(fd.get("status"))) ? str(fd.get("status")) : l.status;
  let nextFollowUp = date(fd.get("nextFollowUp"));
  if (status === "on_hold" && !nextFollowUp) nextFollowUp = addMonths(dayKey(), ON_HOLD_MONTHS);
  if (needsFollowUp(status) && !nextFollowUp) redirect(`/admin/crm/${l.id}?err=followup`); // Golden rule: no empty dates
  const coachId = optStr(fd.get("coachId"));
  const coach = coachId ? await db.user.findFirst({ where: { id: coachId, clubId, role: { in: ["coach", "club_admin"] } } }) : null;
  const day = int(fd.get("scheduleDay"), 1, 7, 0);
  await db.schoolLead.update({
    where: { id: l.id },
    data: {
      ...f, status, nextFollowUp,
      openDayDate: date(fd.get("openDayDate")), openDayTime: time(fd.get("openDayTime")),
      registeredKids: int(fd.get("registeredKids"), 0, 500, l.registeredKids),
      targetKids: int(fd.get("targetKids"), 1, 100, l.targetKids),
      scheduleDay: day || null, scheduleTime: time(fd.get("scheduleTime")), room: optStr(fd.get("room"))?.slice(0, 80) ?? null,
      coachId: coach?.id ?? null, notes: optStr(fd.get("notes"))?.slice(0, 5000) ?? null,
      ...(status === "on_hold" && l.status !== "on_hold" ? { failedCalls: 0 } : {}),
    },
  });
  if (status !== l.status) await logActivity(clubId, l.id, user.id, "status", null, status);
  redirect(`/admin/crm/${l.id}?saved=1`);
}

/** Call answered: log it, reset the 5-touch counter, require the next follow-up date. */
export async function callAnswered(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  const next = date(fd.get("nextFollowUp"));
  const status = STAGE_KEYS.includes(str(fd.get("status"))) ? str(fd.get("status")) : l.status === "lead" || l.status === "on_hold" ? "first_contact" : l.status;
  if (needsFollowUp(status) && !next) redirect(`/admin/crm/${l.id}?err=followup`);
  const checklist = { ...((l.checklist as Record<string, string>) ?? {}), called: dayKey() };
  await db.schoolLead.update({ where: { id: l.id }, data: { failedCalls: 0, nextFollowUp: next ?? l.nextFollowUp, status, checklist } });
  await logActivity(clubId, l.id, user.id, "call", optStr(fd.get("note")));
  if (status !== l.status) await logActivity(clubId, l.id, user.id, "status", null, status);
  redirect(`/admin/crm/${l.id}?done=call`);
}

/** No answer: 5-touch rule. After 5 tries the school goes On hold for 2 months. */
export async function noAnswer(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  const tries = l.failedCalls + 1;
  await logActivity(clubId, l.id, user.id, "no_answer", `Próba ${tries}/${MAX_TOUCHES}`);
  if (tries >= MAX_TOUCHES) {
    await db.schoolLead.update({ where: { id: l.id }, data: { failedCalls: 0, status: "on_hold", nextFollowUp: addMonths(dayKey(), ON_HOLD_MONTHS) } });
    await logActivity(clubId, l.id, user.id, "status", `Brak odpowiedzi po ${MAX_TOUCHES} próbach`, "on_hold");
    redirect(`/admin/crm/${l.id}?done=hold`);
  }
  // Try again on the next working day (at a different hour) unless a later date is already set.
  const next = l.nextFollowUp && l.nextFollowUp > dayKey() ? l.nextFollowUp : nextWorkday();
  await db.schoolLead.update({ where: { id: l.id }, data: { failedCalls: tries, nextFollowUp: next } });
  redirect(`/admin/crm/${l.id}?done=noanswer`);
}

export async function addNote(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  const note = optStr(fd.get("note"));
  if (note) await logActivity(clubId, l.id, user.id, "note", note.slice(0, 2000));
  redirect(`/admin/crm/${l.id}`);
}

export async function toggleStep(fd: FormData) {
  const { l } = await lead(str(fd.get("id")));
  const key = str(fd.get("step"));
  if (!STEP_KEYS.includes(key)) redirect(`/admin/crm/${l.id}`);
  const checklist = { ...((l.checklist as Record<string, string>) ?? {}) };
  if (checklist[key]) delete checklist[key];
  else checklist[key] = dayKey();
  await db.schoolLead.update({ where: { id: l.id }, data: { checklist: checklist as Prisma.InputJsonValue } });
  revalidatePath(`/admin/crm/${l.id}`);
}

/** Send the summary email from the club mailbox (also visible in Poczta). */
export async function sendOffer(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  const club = await db.club.findUniqueOrThrow({ where: { id: clubId } });
  const to = l.email;
  const subject = str(fd.get("subject")).slice(0, 200);
  const text = str(fd.get("text")).slice(0, 10000);
  if (!to || !subject || !text) redirect(`/admin/crm/${l.id}?err=email`);
  const ok = await sendFromPanel({ clubId, clubName: club.name, to, subject, text, mailbox: process.env.MAIL_INBOX ?? null });
  if (!ok) redirect(`/admin/crm/${l.id}?err=send`);
  const checklist = { ...((l.checklist as Record<string, string>) ?? {}), summary_email: dayKey() };
  const status = ["lead", "first_contact"].includes(l.status) ? "offer_sent" : l.status;
  await db.schoolLead.update({ where: { id: l.id }, data: { checklist, status } });
  await logActivity(clubId, l.id, user.id, "email", subject);
  if (status !== l.status) await logActivity(clubId, l.id, user.id, "status", null, status);
  redirect(`/admin/crm/${l.id}?done=email`);
}

/** Create the chess group in the system (schedule, room, coach) once the school is ready. */
export async function createGroup(fd: FormData) {
  const { l, clubId, user } = await lead(str(fd.get("id")));
  if (l.groupId && (await db.group.findFirst({ where: { id: l.groupId, clubId } }))) redirect(`/admin/crm/${l.id}`);
  const g = await db.group.create({
    data: {
      clubId, name: l.schoolName, capacity: Math.max(l.targetKids, l.registeredKids, 8), coachId: l.coachId, isPublic: false,
      ...(l.scheduleDay && l.scheduleTime ? {
        slots: { create: { weekday: l.scheduleDay, startTime: l.scheduleTime, endTime: endTime(l.scheduleTime), location: [l.schoolName, l.room].filter(Boolean).join(", ") } },
      } : {}),
    },
  });
  await db.schoolLead.update({ where: { id: l.id }, data: { groupId: g.id, status: "active" } });
  if (l.status !== "active") await logActivity(clubId, l.id, user.id, "status", "Utworzono grupę w systemie", "active");
  redirect(`/admin/crm/${l.id}?done=group`);
}
function endTime(start: string) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + 60;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export async function deleteSchool(fd: FormData) {
  const { l } = await lead(str(fd.get("id")));
  if (str(fd.get("confirm")).trim().toLowerCase() !== l.schoolName.trim().toLowerCase()) redirect(`/admin/crm/${l.id}`);
  await db.schoolLead.delete({ where: { id: l.id } });
  redirect("/admin/crm?deleted=1");
}
