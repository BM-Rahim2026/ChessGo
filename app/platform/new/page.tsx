import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { str, toCents } from "@/lib/format";
import { trialEnd } from "@/lib/billing";
import { createLogin } from "@/lib/people";
import { ensureDefaultBadges } from "@/lib/gamification";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";

async function create(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  await requireRole("platform_admin");
  const slug = str(fd.get("slug")).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) return { ok: false, message: t("Choose a web address.") };
  if (await db.club.findUnique({ where: { slug } })) return { ok: false, message: t("That web address is taken.") };
  const email = str(fd.get("adminEmail")).toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return { ok: false, message: t("That admin email already has a login.") };
  const now = new Date();
  const club = await db.club.create({
    data: {
      slug, name: str(fd.get("name")), trialEndsAt: trialEnd(now), billingStatus: "trial",
      pricePerStudentCts: toCents(fd.get("price")), minMonthlyFeeCts: toCents(fd.get("min")), maxMonthlyFeeCts: toCents(fd.get("max")),
    },
  });
  await ensureDefaultBadges(club.id);
  const r = await createLogin({ clubId: club.id, email, name: str(fd.get("adminName")), role: "club_admin" });
  return { ok: true, message: t("Created {club} with a 30-day trial. Admin login {email}, temporary password: {pw} (shown once).", { club: club.name, email, pw: r!.password }) };
}

export default async function NewClub() {
  const t = await getT();
  await requireRole("platform_admin");
  return (
    <div>
      <PageHeader title={t("New club")} sub={t("Starts on a 30-day free trial.")} />
      <ActionForm action={create} className="card grid-form max-w-2xl">
        <Field label={t("Club name")}><input className="input" name="name" required /></Field>
        <Field label={t("Web address (/c/…)")}><input className="input" name="slug" required pattern="[a-zA-Z0-9-]+" /></Field>
        <Field label={t("Admin name")}><input className="input" name="adminName" required /></Field>
        <Field label={t("Admin email")}><input className="input" name="adminEmail" type="email" required /></Field>
        <Field label={t("Per active student (PLN)")}><input className="input" name="price" type="number" step="0.01" defaultValue={0.5} /></Field>
        <Field label={t("Minimum monthly fee (PLN)")}><input className="input" name="min" type="number" step="0.01" defaultValue={15} /></Field>
        <Field label={t("Maximum monthly fee (PLN)")}><input className="input" name="max" type="number" step="0.01" defaultValue={150} /></Field>
        <div className="flex items-end justify-end"><button className="btn">{t("Create club")}</button></div>
      </ActionForm>
    </div>
  );
}
