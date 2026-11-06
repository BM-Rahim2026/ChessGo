import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { str, optStr } from "@/lib/format";
import { createLogin, resetLogin } from "@/lib/people";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";

async function addStaff(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const role = str(fd.get("role")) === "club_admin" ? "club_admin" : "coach";
  const r = await createLogin({ clubId, email: str(fd.get("email")), name: str(fd.get("name")), role });
  if (!r) return { ok: false, message: t("That email already has a login.") };
  revalidatePath("/admin/staff");
  return { ok: true, message: t("{email} added. Temporary password: {pw} (shown once).", { email: r.user.email, pw: r.password }) };
}
async function resetPw(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId, user } = await requireStaff(true);
  const id = str(fd.get("id"));
  if (id === user.id) return { ok: false, message: t("Use Account & password to change your own password.") };
  const r = await resetLogin(clubId, id);
  return r ? { ok: true, message: t("New temporary password for {email}: {pw} (shown once).", { email: r.user.email, pw: r.password }) } : { ok: false, message: t("User not found.") };
}

async function saveProfile(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const photo = optStr(fd.get("photoUrl"));
  await db.user.updateMany({
    where: { id: str(fd.get("id")), clubId, role: { in: ["coach", "club_admin"] } },
    data: { name: str(fd.get("name")), bio: optStr(fd.get("bio")), photoUrl: photo && /^https?:\/\//.test(photo) ? photo : null },
  });
  revalidatePath("/admin/staff");
}

export default async function Staff() {
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const staff = await db.user.findMany({ where: { clubId, role: { in: ["coach", "club_admin"] } }, include: { coachedGroups: true }, orderBy: { name: "asc" } });
  return (
    <div>
      <PageHeader title={t("Coaches & staff")} sub={t("Coaches with a bio appear on the public club page.")} />
      <div className="grid gap-4 lg:grid-cols-2">
        {staff.map((u) => (
          <div key={u.id} className="card">
          <form action={saveProfile} className="space-y-2">
            <input type="hidden" name="id" value={u.id} />
            <div className="flex items-center justify-between"><span className="muted">{u.email}</span><span className="pill">{u.role === "club_admin" ? t("Club admin") : t("Coach")}</span></div>
            <Field label={t("Name")}><input className="input" name="name" defaultValue={u.name} /></Field>
            <Field label={t("Bio (public)")}><textarea className="input" name="bio" rows={2} defaultValue={u.bio ?? ""} /></Field>
            <Field label={t("Photo URL")}><input className="input" name="photoUrl" defaultValue={u.photoUrl ?? ""} /></Field>
            <div className="flex items-center justify-between"><span className="muted">{t("Groups")}: {u.coachedGroups.map((g) => g.name).join(", ") || "—"}</span><button className="btn-secondary btn-sm">{t("Save")}</button></div>
          </form>
          <ActionForm action={resetPw} className="mt-2"><input type="hidden" name="id" value={u.id} /><button className="text-xs text-ink-soft underline">{t("Reset password")}</button></ActionForm>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("Add coach or admin")}</h2>
        <ActionForm action={addStaff} className="flex flex-wrap items-end gap-2">
          <Field label={t("Name")}><input className="input" name="name" required /></Field>
          <Field label={t("Email")}><input className="input" name="email" type="email" required /></Field>
          <Field label={t("Role")}><select className="input" name="role"><option value="coach">{t("Coach")}</option><option value="club_admin">{t("Club admin")}</option></select></Field>
          <button className="btn">{t("Add")}</button>
        </ActionForm>
      </div>
    </div>
  );
}
