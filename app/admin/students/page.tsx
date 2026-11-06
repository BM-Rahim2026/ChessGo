import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Empty } from "@/components/ui";
import { str, optStr } from "@/lib/format";
import { findOrCreateParent } from "@/lib/people";
import { getT } from "@/lib/i18n/server";

async function createStudent(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const groupId = optStr(fd.get("groupId"));
  const birth = optStr(fd.get("birthDate"));
  const s = await db.student.create({
    data: {
      clubId, firstName: str(fd.get("firstName")), lastName: str(fd.get("lastName")),
      birthDate: birth ? new Date(birth) : null,
      groupId: groupId && (await db.group.findFirst({ where: { id: groupId, clubId } })) ? groupId : null,
    },
  });
  const email = optStr(fd.get("parentEmail"));
  if (email) {
    const p = await findOrCreateParent(clubId, {
      firstName: str(fd.get("parentFirst")), lastName: str(fd.get("parentLast")) || s.lastName, email, phone: optStr(fd.get("parentPhone")),
    });
    await db.studentParent.create({ data: { studentId: s.id, parentId: p.id } });
  }
  redirect(`/admin/students/${s.id}`);
}

export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; group?: string; deleted?: string }> }) {
  const t = await getT();
  const { clubId, user } = await requireStaff();
  const sp = await searchParams;
  const status = sp.status ?? "active";
  const groups = await db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } });
  const students = await db.student.findMany({
    where: {
      clubId, ...(status !== "all" ? { status } : {}), ...(sp.group ? { groupId: sp.group } : {}),
      ...(sp.q ? { OR: [{ firstName: { contains: sp.q, mode: "insensitive" } }, { lastName: { contains: sp.q, mode: "insensitive" } }] } : {}),
    },
    include: { group: true, parents: { include: { parent: true } }, _count: { select: { badges: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return (
    <div>
      <PageHeader title={t("Students")} sub={t("{n} shown", { n: students.length })} />
      {sp.deleted && <div className="card mb-4 text-sm text-forest">{t("Deleted: {name}", { name: sp.deleted })}</div>}
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" name="q" placeholder={t("Search name")} defaultValue={sp.q} />
        <select className="input max-w-[12rem]" name="group" defaultValue={sp.group ?? ""}>
          <option value="">{t("All groups")}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input max-w-[10rem]" name="status" defaultValue={status}>
          <option value="active">{t("Active")}</option><option value="inactive">{t("Inactive")}</option><option value="all">{t("All")}</option>
        </select>
        <button className="btn-secondary">{t("Filter")}</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {students.length === 0 ? <div className="p-5"><Empty>{t("No students match.")}</Empty></div> : (
          <table className="table">
            <thead><tr><th>{t("Name")}</th><th>{t("Group")}</th><th>{t("Parent")}</th><th>{t("Status")}</th><th className="text-right">{t("XP")}</th><th className="text-right">{t("Badges")}</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/students/${s.id}`} className="font-medium text-brand">{s.firstName} {s.lastName}</Link></td>
                  <td>{s.group?.name ?? "—"}</td>
                  <td className="text-ink-soft">{s.parents.map((p) => `${p.parent.firstName} ${p.parent.lastName}`).join(", ") || "—"}</td>
                  <td><Pill v={s.status} /></td>
                  <td className="text-right tabular-nums">{s.xp}</td>
                  <td className="text-right tabular-nums">{s._count.badges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {user.role === "club_admin" && (
        <div className="card mt-6">
          <h2 className="h2 mb-3">{t("Add student")}</h2>
          <form action={createStudent} className="grid-form">
            <Field label={t("First name")}><input className="input" name="firstName" required /></Field>
            <Field label={t("Last name")}><input className="input" name="lastName" required /></Field>
            <Field label={t("Birth date")}><input className="input" name="birthDate" type="date" /></Field>
            <Field label={t("Group")}>
              <select className="input" name="groupId"><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </Field>
            <Field label={t("Parent first name")}><input className="input" name="parentFirst" /></Field>
            <Field label={t("Parent last name")}><input className="input" name="parentLast" /></Field>
            <Field label={t("Parent email")}><input className="input" name="parentEmail" type="email" /></Field>
            <Field label={t("Parent phone")}><input className="input" name="parentPhone" /></Field>
            <div className="sm:col-span-2 flex justify-end"><button className="btn">{t("Add student")}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
