import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { str, optStr, dayKey, fmtDate } from "@/lib/format";
import { recordAttendanceXp, XP } from "@/lib/gamification";

const STATUSES = ["present", "late", "absent", "excused"] as const;

async function save(fd: FormData) {
  "use server";
  const { clubId, user } = await requireStaff();
  const groupId = str(fd.get("groupId"));
  const dateStr = str(fd.get("date"));
  const group = await db.group.findFirst({ where: { id: groupId, clubId } });
  if (!group || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  if (user.role === "coach" && group.coachId && group.coachId !== user.id) return;
  const date = new Date(dateStr + "T00:00:00.000Z");
  const lesson = await db.lesson.upsert({
    where: { groupId_date: { groupId, date } }, update: { topic: optStr(fd.get("topic")) }, create: { groupId, date, topic: optStr(fd.get("topic")) },
  });
  const students = await db.student.findMany({ where: { groupId, clubId } });
  for (const s of students) {
    const status = str(fd.get(`s_${s.id}`));
    if (!STATUSES.includes(status as (typeof STATUSES)[number])) continue;
    const a = await db.attendance.upsert({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId: s.id } }, update: { status }, create: { lessonId: lesson.id, studentId: s.id, status },
    });
    await recordAttendanceXp(clubId, a.id, s.id, status);
  }
  redirect(`/admin/attendance?group=${groupId}&date=${dateStr}&saved=1`);
}

export default async function Attendance({ searchParams }: { searchParams: Promise<{ group?: string; date?: string; saved?: string }> }) {
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
  const students = groupId ? await db.student.findMany({ where: { groupId, clubId, status: "active" }, orderBy: { firstName: "asc" } }) : [];
  const prev = new Map(lesson?.attendance.map((a) => [a.studentId, a.status]));
  const recent = groupId ? await db.lesson.findMany({ where: { groupId }, orderBy: { date: "desc" }, take: 8, include: { _count: { select: { attendance: { where: { status: { in: ["present", "late"] } } } } } } }) : [];

  return (
    <div>
      <PageHeader title="Attendance" sub={`Present = +${XP.attendance_present} XP, late = +${XP.attendance_late} XP. Changing a mark adjusts XP.`} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Group"><select className="input" name="group" defaultValue={groupId}>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
        <Field label="Date"><input className="input" type="date" name="date" defaultValue={date} /></Field>
        <button className="btn-secondary">Open</button>
      </form>
      {sp.saved && <p className="mb-3 rounded-control bg-mint p-2 text-sm text-forest">Attendance saved.</p>}
      {!groupId ? <Empty>Create a group first.</Empty> : (
        <form action={save} className="card">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="date" value={date} />
          <Field label="Lesson topic" className="mb-4"><input className="input" name="topic" defaultValue={lesson?.topic ?? ""} placeholder="e.g. Knight forks" /></Field>
          {students.length === 0 ? <Empty>No active students in this group.</Empty> : (
            <table className="table">
              <thead><tr><th>Student</th>{STATUSES.map((s) => <th key={s} className="text-center">{s}</th>)}</tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.firstName} {s.lastName}</td>
                    {STATUSES.map((st) => (
                      <td key={st} className="text-center">
                        <input type="radio" name={`s_${s.id}`} value={st} defaultChecked={(prev.get(s.id) ?? "present") === st} aria-label={`${s.firstName} ${st}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 flex justify-end"><button className="btn">Save attendance</button></div>
        </form>
      )}
      {recent.length > 0 && (
        <div className="card mt-6">
          <h2 className="h2 mb-2">Recent lessons</h2>
          <ul className="text-sm">{recent.map((l) => <li key={l.id} className="flex justify-between py-1"><a className="text-brand" href={`/admin/attendance?group=${groupId}&date=${l.date.toISOString().slice(0, 10)}`}>{fmtDate(l.date)} {l.topic ? `· ${l.topic}` : ""}</a><span className="muted">{l._count.attendance} attended</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
