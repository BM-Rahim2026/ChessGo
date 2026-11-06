import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Stat, Pill } from "@/components/ui";
import { monthlyFee, trialDaysLeft } from "@/lib/billing";
import { money, monthKey, fmtDate } from "@/lib/format";

export default async function ClubBilling() {
  const { club } = await requireStaff(true);
  const active = await db.student.count({ where: { clubId: club.id, status: "active" } });
  const est = monthlyFee({ activeStudents: active, pricePerStudentCts: club.pricePerStudentCts, minCts: club.minMonthlyFeeCts, maxCts: club.maxMonthlyFeeCts, period: monthKey(), trialEndsAt: club.trialEndsAt });
  const invoices = await db.platformInvoice.findMany({ where: { clubId: club.id }, orderBy: { period: "desc" }, take: 12 });
  const days = trialDaysLeft(club.trialEndsAt);
  return (
    <div>
      <PageHeader title="ChessGo subscription" sub={`${money(club.pricePerStudentCts)} per active student per month · minimum ${money(club.minMonthlyFeeCts)} · maximum ${money(club.maxMonthlyFeeCts)}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Status" value={<Pill v={club.billingStatus} />} hint={days > 0 ? `Trial ends ${fmtDate(club.trialEndsAt)} (${days} days)` : `Trial ended ${fmtDate(club.trialEndsAt)}`} />
        <Stat label="Active students now" value={active} />
        <Stat label={`Estimate for ${monthKey()}`} value={money(est.amountCts)} hint={est.billableDays < est.daysInMonth ? `${est.billableDays}/${est.daysInMonth} days billable after trial` : undefined} />
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-2">Invoices</h2>
        <table className="table">
          <thead><tr><th>Month</th><th className="text-right">Active students</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
          <tbody>{invoices.map((i) => <tr key={i.id}><td>{i.period}</td><td className="text-right">{i.activeStudents}</td><td className="text-right">{money(i.amountCts)}</td><td>{i.inTrial ? <Pill v="trial">free trial</Pill> : <Pill v={i.paidAt ? "paid" : "unpaid"} />}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
