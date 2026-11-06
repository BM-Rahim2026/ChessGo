import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { money, monthKey, str, optStr, toCents } from "@/lib/format";
import { INTERVALS, issuePlan } from "@/lib/fees";
import { getT } from "@/lib/i18n/server";

async function savePlan(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const id = str(fd.get("id"));
  const interval = str(fd.get("interval"));
  const data = {
    name: str(fd.get("name")), description: optStr(fd.get("description")), priceCts: Math.max(0, toCents(fd.get("price"))),
    interval: (INTERVALS as readonly string[]).includes(interval) ? interval : "month", active: fd.get("active") === "on",
  };
  if (!data.name) return;
  if (id) await db.plan.updateMany({ where: { id, clubId }, data });
  else await db.plan.create({ data: { ...data, clubId } });
  revalidatePath("/admin/plans");
}

async function assignGroup(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const plan = await db.plan.findFirst({ where: { id: str(fd.get("planId")), clubId } });
  const groupId = str(fd.get("groupId"));
  if (!plan || !(await db.group.findFirst({ where: { id: groupId, clubId } }))) return { ok: false, message: t("Choose a group.") };
  const r = await db.student.updateMany({ where: { clubId, groupId, status: "active" }, data: { planId: plan.id } });
  revalidatePath("/admin/plans");
  return { ok: true, message: t("Plan assigned to {n} students.", { n: r.count }) };
}

async function issueNow(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const period = str(fd.get("period"));
  const due = str(fd.get("dueDate"));
  if (!/^\d{4}-\d{2}$/.test(period) || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, message: t("Choose a month and a due date.") };
  const n = await issuePlan(clubId, str(fd.get("planId")), period, new Date(due + "T21:59:00Z"));
  revalidatePath("/admin/plans");
  return { ok: true, message: t("{n} new payment requests created for {period}.", { n, period }) };
}

export default async function Plans() {
  const t = await getT();
  const { clubId, club } = await requireStaff(true);
  const [plans, groups, noPlan] = await Promise.all([
    db.plan.findMany({ where: { clubId }, orderBy: [{ active: "desc" }, { priceCts: "asc" }], include: { _count: { select: { students: { where: { status: "active" } } } } } }),
    db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    db.student.count({ where: { clubId, status: "active", planId: null } }),
  ]);
  const intervalLabel = (i: string) => t(`interval:${i}`);
  const cur = club.currency.toUpperCase();
  const today = new Date().toISOString().slice(0, 10);

  const PlanForm = ({ p }: { p?: (typeof plans)[number] }) => (
    <form key={p ? `${p.id}|${p.name}|${p.priceCts}|${p.interval}|${p.active}|${p.description}` : "new"} action={savePlan} className="grid-form">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label={t("Plan name")}><input className="input" name="name" required defaultValue={p?.name} placeholder={t("e.g. Monthly – 2 lessons a week")} /></Field>
      <Field label={`${t("Price")} (${cur})`}><input className="input" name="price" type="number" step="0.01" min={0} required defaultValue={p ? p.priceCts / 100 : undefined} /></Field>
      <Field label={t("Billing")}>
        <select className="input" name="interval" defaultValue={p?.interval ?? "month"}>{INTERVALS.map((i) => <option key={i} value={i}>{intervalLabel(i)}</option>)}</select>
      </Field>
      <Field label={t("Description (optional)")}><input className="input" name="description" defaultValue={p?.description ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> {t("Active")}</label>
      <div className="flex justify-end"><button className="btn">{p ? t("Save") : t("Add plan")}</button></div>
    </form>
  );

  return (
    <div>
      <PageHeader title={t("Price plans")} sub={t("Set your prices, assign a plan to each student or group, then send payment requests from Tuition payments.")}>
        <Link href="/admin/payments" className="btn-secondary">{t("Tuition payments")}</Link>
      </PageHeader>
      {noPlan > 0 && <p className="mb-4 rounded-card bg-mint p-3 text-sm text-ink">{t("{n} active students have no plan; they are billed their group's monthly fee.", { n: noPlan })}</p>}
      {plans.length === 0 && <Empty>{t("No plans yet. Add your first plan below.")}</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className={`card min-w-0 ${p.active ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h2">{p.name}</h2>
              <span className="font-display text-xl font-semibold text-forest">{money(p.priceCts, club.currency)} <span className="text-sm font-normal text-ink-soft">/ {intervalLabel(p.interval)}</span></span>
            </div>
            <p className="muted">{t("Students on this plan: {n}", { n: p._count.students })}{p.active ? "" : ` · ${t("inactive")}`}</p>
            {p.description && <p className="mt-1 text-sm text-ink">{p.description}</p>}

            <div className="mt-4 space-y-3 border-t border-ink/10 pt-3">
              <ActionForm action={assignGroup} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="planId" value={p.id} />
                <Field label={t("Assign to a whole group")}><select className="input" name="groupId">{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
                <button className="btn-secondary">{t("Assign")}</button>
              </ActionForm>
              <ActionForm action={issueNow} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="planId" value={p.id} />
                <Field label={t("Month")}><input className="input" type="month" name="period" defaultValue={monthKey()} /></Field>
                <Field label={t("Due date")}><input className="input" type="date" name="dueDate" defaultValue={today} /></Field>
                <button className="btn-secondary">{t("Create payment requests")}</button>
              </ActionForm>
              <details><summary className="cursor-pointer text-sm font-semibold text-forest underline">{t("Edit plan")}</summary><div className="mt-3"><PlanForm p={p} /></div></details>
            </div>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("New plan")}</h2>
        <PlanForm />
      </div>
    </div>
  );
}
