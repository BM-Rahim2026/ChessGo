import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { WEEKDAYS, money, str, optStr, toCents } from "@/lib/format";

async function saveGroup(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const id = str(fd.get("id"));
  const data = {
    name: str(fd.get("name")), level: optStr(fd.get("level")), ageRange: optStr(fd.get("ageRange")),
    capacity: Math.max(1, Number(fd.get("capacity")) || 12), monthlyFeeCts: toCents(fd.get("monthlyFee")),
    coachId: optStr(fd.get("coachId")), isPublic: fd.get("isPublic") === "on",
  };
  if (data.coachId && !(await db.user.findFirst({ where: { id: data.coachId, clubId } }))) data.coachId = null;
  if (id) await db.group.updateMany({ where: { id, clubId }, data });
  else await db.group.create({ data: { ...data, clubId } });
  revalidatePath("/admin/groups");
}
async function deleteGroup(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  await db.group.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/groups");
}
async function addSlot(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const groupId = str(fd.get("groupId"));
  if (!(await db.group.findFirst({ where: { id: groupId, clubId } }))) return;
  await db.scheduleSlot.create({
    data: { groupId, weekday: Number(fd.get("weekday")), startTime: str(fd.get("startTime")), endTime: str(fd.get("endTime")), location: optStr(fd.get("location")) },
  });
  revalidatePath("/admin/groups");
}
async function deleteSlot(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  await db.scheduleSlot.deleteMany({ where: { id: str(fd.get("id")), group: { clubId } } });
  revalidatePath("/admin/groups");
}

export default async function Groups() {
  const { clubId, club, user } = await requireStaff();
  const isAdmin = user.role === "club_admin";
  const [groups, coaches] = await Promise.all([
    db.group.findMany({
      where: { clubId }, orderBy: { name: "asc" },
      include: { coach: true, slots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }, _count: { select: { students: { where: { status: "active" } } } } },
    }),
    db.user.findMany({ where: { clubId, role: { in: ["coach", "club_admin"] } }, orderBy: { name: "asc" } }),
  ]);

  const GroupForm = ({ g }: { g?: (typeof groups)[number] }) => (
    <form key={g ? `${g.id}|${g.name}|${g.level}|${g.ageRange}|${g.capacity}|${g.monthlyFeeCts}|${g.coachId}|${g.isPublic}` : "new"} action={saveGroup} className="grid-form">
      {g && <input type="hidden" name="id" value={g.id} />}
      <Field label="Name"><input className="input" name="name" required defaultValue={g?.name} /></Field>
      <Field label="Level"><input className="input" name="level" defaultValue={g?.level ?? ""} placeholder="Beginner" /></Field>
      <Field label="Ages"><input className="input" name="ageRange" defaultValue={g?.ageRange ?? ""} placeholder="6–8" /></Field>
      <Field label="Capacity"><input className="input" name="capacity" type="number" min={1} defaultValue={g?.capacity ?? 12} /></Field>
      <Field label={`Monthly fee (${club.currency.toUpperCase()})`}><input className="input" name="monthlyFee" type="number" step="0.01" defaultValue={g ? g.monthlyFeeCts / 100 : 60} /></Field>
      <Field label="Coach">
        <select className="input" name="coachId" defaultValue={g?.coachId ?? ""}>
          <option value="">—</option>
          {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={g?.isPublic ?? true} /> Show on public page</label>
      <div className="flex justify-end"><button className="btn">{g ? "Save" : "Create group"}</button></div>
    </form>
  );

  return (
    <div>
      <PageHeader title="Groups & schedule" sub="Weekly time slots appear on the public club page." />
      {groups.length === 0 && <Empty>No groups yet.</Empty>}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.id} className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h2">{g.name} <span className="muted font-normal">· {g.level ?? "—"} · ages {g.ageRange ?? "—"}</span></h2>
              <span className="muted">{g._count.students}/{g.capacity} students · {money(g.monthlyFeeCts, club.currency)}/mo · coach {g.coach?.name ?? "—"}</span>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.slots.map((s) => (
                <li key={s.id} className="pill gap-2">
                  {WEEKDAYS[s.weekday]} {s.startTime}–{s.endTime}{s.location ? ` · ${s.location}` : ""}
                  {isAdmin && <form action={deleteSlot}><input type="hidden" name="id" value={s.id} /><button className="text-red-600" title="Remove">×</button></form>}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-brand">Edit group / add time slot</summary>
                <div className="mt-3 space-y-4">
                  <GroupForm g={g} />
                  <form action={addSlot} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="groupId" value={g.id} />
                    <Field label="Day"><select className="input" name="weekday">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}</select></Field>
                    <Field label="Start"><input className="input" type="time" name="startTime" required defaultValue="17:00" /></Field>
                    <Field label="End"><input className="input" type="time" name="endTime" required defaultValue="18:30" /></Field>
                    <Field label="Location"><input className="input" name="location" /></Field>
                    <button className="btn-secondary">Add slot</button>
                  </form>
                  <form action={deleteGroup}><input type="hidden" name="id" value={g.id} /><button className="btn-danger">Delete group</button></form>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <div className="card mt-6">
          <h2 className="h2 mb-3">New group</h2>
          <GroupForm />
        </div>
      )}
    </div>
  );
}
