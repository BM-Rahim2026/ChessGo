import { inGroup } from "@/lib/groups";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { str, optStr, dayKey, fmtDate } from "@/lib/format";
import { recordAttendanceXp, XP } from "@/lib/gamification";
import { getT } from "@/lib/i18n/server";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { AttendanceSheet, DateJump } from "@/components/AttendanceSheet";
import { getLocale } from "@/lib/i18n/server";

const STATUSES = ["present", "late", "absent", "excused"] as const;

/** Group the user may edit: admins every group, coaches their own (or unassigned) groups. */
async function editableGroup(groupId: string) {
  const { clubId, user } = await requireStaff();
  const group = await db.group.findFirst({ where: { id: groupId, clubId } });
  if (!group) return null;
  if (user.role === "coach" && group.coachId && group.coachId !== user.id) return null;
  return { group, clubId };
}

async function save(fd: FormData) {
  "use server";
  const groupId = str(fd.get("groupId"));
  const dateStr = str(fd.get("date"));
  const ok = await editableGroup(groupId);
  if (!ok || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  const { clubId } = ok;
  const date = new Date(dateStr + "T00:00:00.000Z");
  const lesson = await db.lesson.upsert({
    where: { groupId_date: { groupId, date } }, update: { topic: optStr(fd.get("topic")) }, create: { groupId, date, topic: optStr(fd.get("topic")) },
  });
  // Everyone shown on the form: group members plus anyone already marked in this lesson.
  const marked = await db.attendance.findMany({ where: { lessonId: lesson.id } });
  const students = await db.student.findMany({ where: { clubId, OR: [inGroup(groupId), { id: { in: marked.map((m) => m.studentId) } }] } });
  for (const s of students) {
    const status = str(fd.get(`s_${s.id}`));
    if (status === "none") {
      // Clear the mark: remove the record and take back its XP.
      const old = marked.find((m) => m.studentId === s.id);
      if (old) {
        await recordAttendanceXp(clubId, old.id, s.id, "absent");
        await db.attendance.delete({ where: { id: old.id } });
      }
      continue;
    }
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) continue;
    const a = await db.attendance.upsert({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId: s.id } }, update: { status }, create: { lessonId: lesson.id, studentId: s.id, status },
    });
    await recordAttendanceXp(clubId, a.id, s.id, status);
  }
  redirect(`/admin/attendance?group=${groupId}&date=${dateStr}&saved=1`);
}

/** Delete a whole lesson with its attendance, taking back the XP it gave. */
async function deleteLesson(fd: FormData) {
  "use server";
  const lesson = await db.lesson.findUnique({ where: { id: str(fd.get("id")) }, include: { attendance: true } });
  if (!lesson) redirect("/admin/attendance");
  const ok = await editableGroup(lesson.groupId);
  const day = lesson.date.toISOString().slice(0, 10);
  if (!ok || str(fd.get("confirm")).trim() !== day) redirect(`/admin/attendance?group=${lesson.groupId}&date=${day}`);
  for (const a of lesson.attendance) await recordAttendanceXp(ok.clubId, a.id, a.studentId, "absent");
  await db.lesson.delete({ where: { id: lesson.id } });
  redirect(`/admin/attendance?group=${lesson.groupId}&date=${day}&deleted=1`);
}

/** Move a lesson to another date (e.g. it was saved on the wrong day). */
async function moveLesson(fd: FormData) {
  "use server";
  const lesson = await db.lesson.findUnique({ where: { id: str(fd.get("id")) } });
  if (!lesson) redirect("/admin/attendance");
  const ok = await editableGroup(lesson.groupId);
  const to = str(fd.get("to"));
  const day = lesson.date.toISOString().slice(0, 10);
  if (!ok || !/^\d{4}-\d{2}-\d{2}$/.test(to)) redirect(`/admin/attendance?group=${lesson.groupId}&date=${day}`);
  const taken = await db.lesson.findUnique({ where: { groupId_date: { groupId: lesson.groupId, date: new Date(to + "T00:00:00.000Z") } } });
  if (taken && taken.id !== lesson.id) redirect(`/admin/attendance?group=${lesson.groupId}&date=${day}&err=taken`);
  await db.lesson.update({ where: { id: lesson.id }, data: { date: new Date(to + "T00:00:00.000Z") } });
  redirect(`/admin/attendance?group=${lesson.groupId}&date=${to}&moved=1`);
}

export default async function Attendance({ searchParams }: { searchParams: Promise<{ group?: string; date?: string; saved?: string; deleted?: string; moved?: string; err?: string }> }) {
  const t = await getT();
  const locale = await getLocale();
  const { clubId, user } = await requireStaff();
  const sp = await searchParams;
  const groups = await db.group.findMany({
    where: { clubId, ...(user.role === "coach" ? { OR: [{ coachId: user.id }, { coachId: null }] } : {}) }, orderBy: { name: "asc" },
  });
  const groupId = sp.group ?? groups[0]?.id;
  const date = sp.date ?? dayKey();
  const lesson = groupId ? await db.lesson.findUnique({
    where: { groupId_date: { groupId, date: new Date(date + "T00:00:00.000Z") } }, include: { attendance: true },
  }) : null;
  // Active group members, plus anyone already marked in this lesson (even if they left the group since).
  const markedIds = lesson?.attendance.map((a) => a.studentId) ?? [];
  const students = groupId ? await db.student.findMany({
    where: { clubId, OR: [{ status: "active", ...inGroup(groupId) }, { id: { in: markedIds } }] }, orderBy: { firstName: "asc" },
  }) : [];
  const prev = new Map(lesson?.attendance.map((a) => [a.studentId, a.status]));
  const recent = groupId ? await db.lesson.findMany({ where: { groupId }, orderBy: { date: "desc" }, take: 8, include: { _count: { select: { attendance: { where: { status: { in: ["present", "late"] } } } } } } }) : [];

  const group = groups.find((g) => g.id === groupId);
  const today = dayKey();
  const dateLabel = (d: string) => new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d + "T00:00:00Z"));
  const recentKeys = new Set(recent.map((l) => l.date.toISOString().slice(0, 10)));
  const link = (g: string, d: string) => `/admin/attendance?group=${g}&date=${d}`;

  return (
    <div>
      <PageHeader title={t("Attendance")} sub={t("Present = +{a} XP, late = +{b} XP. Changing a mark adjusts XP.", { a: XP.attendance_present, b: XP.attendance_late })} />

      {sp.saved && <p className="mb-3 rounded-control bg-mint p-3 text-sm font-semibold text-forest">✓ {t("Attendance saved.")}</p>}
      {sp.deleted && <p className="mb-3 rounded-control bg-mint p-3 text-sm text-forest">{t("Lesson deleted. The XP it gave was taken back.")}</p>}
      {sp.moved && <p className="mb-3 rounded-control bg-mint p-3 text-sm text-forest">{t("Lesson moved to {d}.", { d: fmtDate(new Date(date + "T12:00:00Z")) })}</p>}
      {sp.err === "taken" && <p className="mb-3 rounded-control bg-red-50 p-3 text-sm text-red-800">{t("There is already a lesson on that date. Open it and edit it instead.")}</p>}

      {!groupId ? <Empty>{t("Create a group first.")}</Empty> : (
        <>
          {/* Step 1: group */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">1. {t("Choose the group")}</h2>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <a key={g.id} href={link(g.id, date)} aria-current={g.id === groupId ? "page" : undefined}
                  className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold ${g.id === groupId ? "border-forest bg-forest text-white" : "border-ink/20 bg-white text-forest hover:bg-mint"}`}>
                  {g.name}
                </a>
              ))}
            </div>
          </section>

          {/* Step 2: lesson */}
          <section className="mb-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">2. {t("Choose the lesson")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {!recentKeys.has(today) && (
                <a href={link(groupId, today)} className={`min-h-[44px] rounded-control border px-3 py-2 text-sm font-semibold ${date === today ? "border-forest bg-forest text-white" : "border-dashed border-forest/50 bg-white text-forest hover:bg-mint"}`}>
                  + {t("Today")} <span className="font-normal">({t("new")})</span>
                </a>
              )}
              {recent.map((l) => {
                const k = l.date.toISOString().slice(0, 10);
                const on = k === date;
                return (
                  <a key={l.id} href={link(groupId, k)} title={l.topic ?? ""}
                    className={`min-h-[44px] rounded-control border px-3 py-1.5 text-left text-sm ${on ? "border-forest bg-forest text-white" : "border-ink/15 bg-white text-ink hover:bg-mint"}`}>
                    <span className="block font-semibold">✓ {fmtDate(l.date)}{k === today ? ` · ${t("Today")}` : ""}</span>
                    <span className={`block text-xs ${on ? "text-white/80" : "text-ink-soft"}`}>{t("{n} attended", { n: l._count.attendance })}</span>
                  </a>
                );
              })}
              <span className="ml-1"><DateJump groupId={groupId} date={date} label={t("Other day:")} /></span>
            </div>
          </section>

          {/* Step 3: marks */}
          <section className="card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">3. {t("Mark attendance")}</h2>
                <p className="mt-1 font-display text-2xl font-semibold text-forest">{group?.name} · {dateLabel(date).charAt(0).toUpperCase() + dateLabel(date).slice(1)}</p>
              </div>
              {lesson
                ? <span className="pill pill-green">✓ {t("Saved — you can change any mark")}</span>
                : <span className="pill bg-go/40 text-forest">● {t("New lesson — not saved yet")}</span>}
            </div>
            {students.length === 0 ? <Empty>{t("No active students in this group.")}</Empty> : (
              <AttendanceSheet key={`${groupId}|${date}|${lesson?.topic ?? ""}|${lesson?.attendance.map((a) => a.studentId + a.status).join(",") ?? "new"}`}
                action={save} groupId={groupId} date={date} topic={lesson?.topic ?? ""} saved={Boolean(lesson)}
                students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, inactive: s.status !== "active", mark: prev.get(s.id) ?? null }))}
                labels={{
                  present: t("status:present"), late: t("status:late"), absent: t("status:absent"), excused: t("status:excused"),
                  clear: t("Remove mark"), allPresent: t("Everyone present"), topic: t("Lesson topic"), topicPh: t("e.g. Knight forks"),
                  save: t("Save changes"), saveNew: t("Save attendance"), unsaved: t("Unsaved changes"), nothingChanged: t("All changes saved"),
                  inactive: t("status:inactive"), notMarked: t("not marked"), counts: "",
                }} />
            )}
          </section>

          {lesson && (
            <details className="card mt-4">
              <summary className="cursor-pointer font-semibold text-forest">⚙ {t("Lesson options: change the date or delete")}</summary>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
                <form action={moveLesson} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={lesson.id} />
                  <Field label={t("Move this lesson to another date")}><input className="input" type="date" name="to" required defaultValue={date} /></Field>
                  <button className="btn-secondary">{t("Move")}</button>
                </form>
                <div className="min-w-[16rem] max-w-md flex-1">
                  <ConfirmDelete action={deleteLesson} id={lesson.id} name={date} labels={{
                    open: t("Delete this lesson…"), title: t("Delete the lesson of {d}?", { d: fmtDate(lesson.date) }),
                    typeToConfirm: t("To confirm, type the date:"), confirm: t("Delete permanently"), cancel: t("Cancel"),
                  }} warnings={[t("{n} attendance marks will be deleted.", { n: lesson.attendance.length }), t("XP from this lesson is taken back from the students.")]} />
                </div>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
