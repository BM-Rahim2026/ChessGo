import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Empty, Tabs } from "@/components/ui";
import { money, monthKey, str, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

async function generate(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const period = str(fd.get("period"));
  if (!/^\d{4}-\d{2}$/.test(period)) return;
  const dueDay = Math.min(28, Math.max(1, Number(fd.get("dueDay")) || 10));
  const [y, m] = period.split("-").map(Number);
  const students = await db.student.findMany({ where: { clubId, status: "active", groupId: { not: null } }, include: { group: true } });
  for (const s of students) {
    await db.feeInvoice.upsert({
      where: { studentId_period: { studentId: s.id, period } }, update: {},
      create: { clubId, studentId: s.id, period, amountCts: s.group!.monthlyFeeCts, dueDate: new Date(y, m - 1, dueDay, 23, 59) },
    });
  }
  revalidatePath("/admin/payments");
}

async function markPaid(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const paid = str(fd.get("paid")) === "1";
  await db.feeInvoice.updateMany({ where: { id: str(fd.get("id")), clubId }, data: paid ? { paidAt: new Date(), method: str(fd.get("method")) || "cash" } : { paidAt: null, method: null } });
  revalidatePath("/admin/payments");
}

export default async function Payments({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const t = await getT();
  const { clubId, club } = await requireStaff(true);
  const sp = await searchParams;
  const period = sp.period ?? monthKey();
  const view = sp.view ?? "all";
  const now = new Date();
  const invoices = await db.feeInvoice.findMany({
    where: { clubId, period, ...(view === "unpaid" ? { paidAt: null } : view === "overdue" ? { paidAt: null, dueDate: { lt: now } } : {}) },
    include: { student: { include: { group: true } } }, orderBy: { student: { lastName: "asc" } },
  });
  const total = invoices.reduce((a, i) => a + i.amountCts, 0);
  const paid = invoices.filter((i) => i.paidAt).reduce((a, i) => a + i.amountCts, 0);
  const q = (v: string) => `/admin/payments?period=${period}&view=${v}`;
  return (
    <div>
      <PageHeader title={t("Tuition payments")} sub={t("Monthly invoices per active student, from each group's fee.")} />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form className="flex items-end gap-2"><Field label={t("Month")}><input className="input" type="month" name="period" defaultValue={period} /></Field><button className="btn-secondary">{t("Show")}</button></form>
        <form action={generate} className="flex items-end gap-2">
          <input type="hidden" name="period" value={period} />
          <Field label={t("Due day")}><input className="input w-20" type="number" name="dueDay" defaultValue={10} min={1} max={28} /></Field>
          <button className="btn">{t("Generate invoices for {period}", { period })}</button>
        </form>
      </div>
      <Tabs active={view} items={[{ key: "all", label: t("All"), href: q("all") }, { key: "unpaid", label: t("Unpaid"), href: q("unpaid") }, { key: "overdue", label: t("Overdue"), href: q("overdue") }]} />
      <p className="muted mb-2">{t("{paid} collected of {total}", { paid: money(paid, club.currency), total: money(total, club.currency) })}</p>
      <div className="card overflow-x-auto p-0">
        {invoices.length === 0 ? <div className="p-5"><Empty>{t("No invoices for {period}. Generate them above.", { period })}</Empty></div> : (
          <table className="table">
            <thead><tr><th>{t("Student")}</th><th>{t("Group")}</th><th>{t("Amount")}</th><th>{t("Due")}</th><th>{t("Status")}</th><th></th></tr></thead>
            <tbody>{invoices.map((i) => (
              <tr key={i.id}>
                <td>{i.student.firstName} {i.student.lastName}</td><td>{i.student.group?.name ?? "—"}</td>
                <td className="tabular-nums">{money(i.amountCts, club.currency)}</td><td>{fmtDate(i.dueDate)}</td>
                <td><Pill v={i.paidAt ? "paid" : i.dueDate < now ? "overdue" : "unpaid"} />{i.method ? <span className="muted"> · {t(`method:${i.method}`)}</span> : null}</td>
                <td className="text-right">
                  <form action={markPaid} className="flex flex-wrap justify-end gap-1">
                    <input type="hidden" name="id" value={i.id} />
                    {i.paidAt ? (<><input type="hidden" name="paid" value="0" /><button className="btn-secondary btn-sm">{t("Undo")}</button></>) : (
                      <><input type="hidden" name="paid" value="1" />
                        <select name="method" className="input w-auto py-1"><option value="cash">{t("method:cash")}</option><option value="card">{t("method:card")}</option><option value="transfer">{t("method:transfer")}</option></select>
                        <button className="btn btn-sm">{t("Mark paid")}</button></>
                    )}
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
