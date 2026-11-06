import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { str, optStr } from "@/lib/format";
import { createLogin, resetLogin } from "@/lib/people";
import { ActionForm, type ActionResult } from "@/components/ActionForm";

async function addStaff(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const { clubId } = await requireStaff(true);
  const role = str(fd.get("role")) === "club_admin" ? "club_admin" : "coach";
  const r = await createLogin({ clubId, email: str(fd.get("email")), name: str(fd.get("name")), role });
  if (!r) return { ok: false, message: "That email already has a login." };
  revalidatePath("/admin/staff");
  return { ok: true, message: `${r.user.email} added. Temporary password: ${r.password} (shown once).` };
}
async function resetPw(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const { clubId, user } = await requireStaff(true);
  const id = str(fd.get("id"));
  if (id === user.id) return { ok: false, message: "Use Account & password to change your own password." };
  const r = await resetLogin(clubId, id);
  return r ? { ok: true, message: `New temporary password for ${r.user.email}: ${r.password} (shown once).` } : { ok: false, message: "User not found." };
}

async function saveProfile(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const photo = optStr(fd.get("photoUrl"));
  await db.user.updateMany({
    where: { id: str(fd.get("id")), clubId, role: { in: ["coach", "club_admin"] } },
    data: { name: str(fd.get("name")), bio: optStr(fd.get("bio")), photoUrl: photo && /^https?:\/\//.test(photo) ? photo : null },
  });
  revalidatePath("/admin/staff");
}

export default async function Staff() {
  const { clubId } = await requireStaff(true);
  const staff = await db.user.findMany({ where: { clubId, role: { in: ["coach", "club_admin"] } }, include: { coachedGroups: true }, orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader title="Coaches & staff" sub="Coaches with a bio appear on the public club page." />
      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map((u) => (
          <div key={u.id} className="card">
          <form action={saveProfile} className="space-y-2">
            <input type="hidden" name="id" value={u.id} />
            <div className="flex items-center justify-between"><span className="muted">{u.email}</span><span className="pill">{u.role === "club_admin" ? "admin" : "coach"}</span></div>
            <Field label="Name"><input className="input" name="name" defaultValue={u.name} /></Field>
            <Field label="Bio (public)"><textarea className="input" name="bio" rows={2} defaultValue={u.bio ?? ""} /></Field>
            <Field label="Photo URL"><input className="input" name="photoUrl" defaultValue={u.photoUrl ?? ""} /></Field>
            <div className="flex items-center justify-between"><span className="muted">Groups: {u.coachedGroups.map((g) => g.name).join(", ") || "—"}</span><button className="btn-secondary btn-sm">Save</button></div>
          </form>
          <ActionForm action={resetPw} className="mt-2"><input type="hidden" name="id" value={u.id} /><button className="text-xs text-ink-soft underline">Reset password</button></ActionForm>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">Add coach or admin</h2>
        <ActionForm action={addStaff} className="flex flex-wrap items-end gap-2">
          <Field label="Name"><input className="input" name="name" required /></Field>
          <Field label="Email"><input className="input" name="email" type="email" required /></Field>
          <Field label="Role"><select className="input" name="role"><option value="coach">Coach</option><option value="club_admin">Club admin</option></select></Field>
          <button className="btn">Add</button>
        </ActionForm>
      </div>
    </div>
  );
}
