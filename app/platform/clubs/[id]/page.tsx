import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Stat } from "@/components/ui";
import { money, str, toCents, fmtDate } from "@/lib/format";
import { trialDaysLeft } from "@/lib/billing";

async function save(fd: FormData) {
  "use server";
  await requireRole("platform_admin");
  const id = str(fd.get("id"));
  const status = str(fd.get("billingStatus"));
  const min = toCents(fd.get("min")), max = toCents(fd.get("max"));
  await db.club.update({
    where: { id },
    data: {
      pricePerStudentCts: Math.max(0, toCents(fd.get("price"))), minMonthlyFeeCts: Math.max(0, min), maxMonthlyFeeCts: Math.max(min, max),
      billingStatus: ["trial", "active", "past_due", "suspended"].includes(status) ? status : "trial",
      trialEndsAt: new Date(str(fd.get("trialEndsAt")) + "T23:59:59"),
    },
  });
  revalidatePath(`/platform/clubs/${id}`);
}
async function togglePaid(fd: FormData) {
  "use server";
  await requireRole("platform_admin");
  const inv = await db.platformInvoice.findUnique({ where: { id: str(fd.get("invoiceId")) } });
  if (inv) await db.platformInvoice.update({ where: { id: inv.id }, data: { paidAt: inv.paidAt ? null : new Date() } });
  revalidatePath(`/platform/clubs/${str(fd.get("id"))}`);
}

export default async function ClubDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("platform_admin");
  const { id } = await params;
  const c = await db.club.findUnique({
    where: { id },
    include: { platformInvoices: { orderBy: { period: "desc" } }, users: { where: { role: "club_admin" } }, _count: { select: { students: { where: { status: "active" } }, groups: true } } },
  });
  if (!c) notFound();
  const inactive = await db.student.count({ where: { clubId: id, status: "inactive" } });
  return (
    <div>
      <PageHeader title={c.name} sub={`/c/${c.slug} · admins: ${c.users.map((u) => u.email).join(", ") || "—"}`}><Pill v={c.billingStatus} /></PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Active students" value={c._count.students} hint={`${inactive} inactive`} />
        <Stat label="Groups" value={c._count.groups} />
        <Stat label="Trial" value={`${trialDaysLeft(c.trialEndsAt)} days`} hint={`ends ${fmtDate(c.trialEndsAt)}`} />
        <Stat label="Lifetime billed" value={money(c.platformInvoices.reduce((a, i) => a + i.amountCts, 0))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <form key={`${c.pricePerStudentCts}|${c.minMonthlyFeeCts}|${c.maxMonthlyFeeCts}|${c.billingStatus}|${c.trialEndsAt.toISOString()}`} action={save} className="card grid-form">
          <input type="hidden" name="id" value={c.id} />
          <h2 className="h2 sm:col-span-2">Pricing & status</h2>
          <Field label="Per active student (€)"><input className="input" name="price" type="number" step="0.01" defaultValue={c.pricePerStudentCts / 100} /></Field>
          <Field label="Status"><select className="input" name="billingStatus" defaultValue={c.billingStatus}><option value="trial">trial</option><option value="active">active</option><option value="past_due">past due</option><option value="suspended">suspended</option></select></Field>
          <Field label="Minimum monthly fee (€)"><input className="input" name="min" type="number" step="0.01" defaultValue={c.minMonthlyFeeCts / 100} /></Field>
          <Field label="Maximum monthly fee (€)"><input className="input" name="max" type="number" step="0.01" defaultValue={c.maxMonthlyFeeCts / 100} /></Field>
          <Field label="Trial ends"><input className="input" name="trialEndsAt" type="date" defaultValue={c.trialEndsAt.toISOString().slice(0, 10)} /></Field>
          <div className="flex items-end justify-end"><button className="btn">Save</button></div>
          <p className="muted sm:col-span-2">Suspended clubs&apos; public pages go offline.</p>
        </form>
        <div className="card">
          <h2 className="h2 mb-2">Invoices</h2>
          <table className="table">
            <thead><tr><th>Month</th><th className="text-right">Students</th><th className="text-right">Raw</th><th className="text-right">Billed</th><th></th></tr></thead>
            <tbody>{c.platformInvoices.map((i) => (
              <tr key={i.id}>
                <td>{i.period}</td><td className="text-right">{i.activeStudents}</td><td className="text-right">{money(i.rawCts)}</td><td className="text-right">{money(i.amountCts)}</td>
                <td className="text-right">{i.inTrial ? <Pill v="trial">free trial</Pill> : (
                  <form action={togglePaid}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="invoiceId" value={i.id} /><button className={i.paidAt ? "pill pill-green" : "btn-secondary btn-sm"}>{i.paidAt ? "paid ✓" : "Mark paid"}</button></form>
                )}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
