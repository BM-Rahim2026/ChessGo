import { inGroup } from "@/lib/groups";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { str, optStr, dayKey, fmtDate } from "@/lib/format";
import { recordAttendanceXp, XP } from "@/lib/gamification";
import { getT } from "@/lib/i18n/server";
import { ConfirmDelete } from "@/components/ConfirmDelete";

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

  return (
    <div>
      <PageHeader title={t("Attendance")} sub={t("Present = +{a} XP, late = +{b} XP. Changing a mark adjusts XP.", { a: XP.attendance_present, b: XP.attendance_late })} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Field label={t("Group")}><select className="input" name="group" defaultValue={groupId}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label={t("Date")}><input className="input" type="date" name="date" defaultValue={date} /></Field>
        <button className="btn-secondary">{t("Open")}</button>
      </form>
      {sp.saved && <p className="mb-3 rounded-control bg-mint p-2 text-sm text-forest">{t("Attendance saved.")}</p>}
      {sp.deleted && <p className="mb-3 rounded-control bg-mint p-2 text-sm text-forest">{t("Lesson deleted. The XP it gave was taken back.")}</p>}
      {sp.moved && <p className="mb-3 rounded-control bg-mint p-2 text-sm text-forest">{t("Lesson moved to {d}.", { d: fmtDate(new Date(date + "T12:00:00Z")) })}</p>}
      {sp.err === "taken" && <p className="mb-3 rounded-control bg-red-50 p-2 text-sm text-red-800">{t("There is already a lesson on that date. Open it and edit it instead.")}</p>}
      {lesson && <p className="mb-3 text-sm text-ink-soft">✎ {t("This lesson is already saved — change any mark and save again.")}</p>}
      {!groupId ? <Empty>{t("Create a group first.")}</Empty> : (
        <form key={`${groupId}|${date}|${lesson?.topic ?? ""}|${lesson?.attendance.map((a) => a.studentId + a.status).join(",") ?? "new"}`} action={save} className="card">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="date" value={date} />
          <Field label={t("Lesson topic")} className="mb-4"><input className="input" name="topic" defaultValue={lesson?.topic ?? ""} placeholder={t("e.g. Knight forks")} /></Field>
          {students.length === 0 ? <Empty>{t("No active students in this group.")}</Empty> : (
            <ul className="divide-y divide-ink/10">
              {students.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-semibold text-ink">{s.firstName} {s.lastName}{s.status !== "active" && <span className="ml-2 pill">{t("status:inactive")}</span>}</span>
                  <fieldset className="flex flex-wrap gap-1.5">
                    <legend className="sr-only">{s.firstName} {s.lastName}</legend>
                    {[...STATUSES, ...(lesson ? (["none"] as const) : [])].map((st) => (
                      <label key={st} className="cursor-pointer">
                        <input type="radio" className="peer sr-only" name={`s_${s.id}`} value={st} defaultChecked={(prev.get(s.id) ?? (lesson ? "none" : "present")) === st} />
                        <span className="inline-flex min-h-[40px] items-center rounded-control border border-ink/20 bg-white px-3 text-sm font-semibold text-ink peer-checked:border-forest peer-checked:bg-forest peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest">
                          {st === "none" ? t("— not marked") : t(`status:${st}`)}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end"><button className="btn btn-lg w-full sm:w-auto">{lesson ? t("Save changes") : t("Save attendance")}</button></div>
        </form>
      )}
      {lesson && (
        <div className="card mt-4 flex flex-wrap items-start justify-between gap-4">
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
      )}
      {recent.length > 0 && (
        <div className="card mt-6">
          <h2 className="h2 mb-2">{t("Recent lessons")}</h2>
          <ul className="text-sm">{recent.map((l) => <li key={l.id} className="flex justify-between py-1"><a className="text-brand" href={`/admin/attendance?group=${groupId}&date=${l.date.toISOString().slice(0, 10)}`}>{fmtDate(l.date)} {l.topic ? `· ${l.topic}` : ""}</a><span className="flex items-center gap-3"><span className="muted">{t("{n} attended", { n: l._count.attendance })}</span><a className="text-sm font-semibold text-forest underline" href={`/admin/attendance?group=${groupId}&date=${l.date.toISOString().slice(0, 10)}`}>✎ {t("Edit")}</a></span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
