import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Stat, Pill } from "@/components/ui";
import { monthlyFee, trialDaysLeft } from "@/lib/billing";
import { money, monthKey, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export default async function ClubBilling() {
  const t = await getT();
  const { club } = await requireStaff(true);
  const active = await db.student.count({ where: { clubId: club.id, status: "active" } });
  const est = monthlyFee({ activeStudents: active, pricePerStudentCts: club.pricePerStudentCts, minCts: club.minMonthlyFeeCts, maxCts: club.maxMonthlyFeeCts, period: monthKey(), trialEndsAt: club.trialEndsAt });
  const invoices = await db.platformInvoice.findMany({ where: { clubId: club.id }, orderBy: { period: "desc" }, take: 12 });
  const days = trialDaysLeft(club.trialEndsAt);
  return (
    <div>
      <PageHeader title={t("ChessGo subscription")} sub={t("{price} per active student per month · minimum {min} · maximum {max}", { price: money(club.pricePerStudentCts, "pln"), min: money(club.minMonthlyFeeCts, "pln"), max: money(club.maxMonthlyFeeCts, "pln") })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Status")} value={<Pill v={club.billingStatus} />} hint={days > 0 ? t("Trial ends {date} ({n} days)", { date: fmtDate(club.trialEndsAt), n: days }) : t("Trial ended {date}", { date: fmtDate(club.trialEndsAt) })} />
        <Stat label={t("Active students now")} value={active} />
        <Stat label={t("Estimate for {month}", { month: monthKey() })} value={money(est.amountCts, "pln")} hint={est.billableDays < est.daysInMonth ? t("{a}/{b} days billable after trial", { a: est.billableDays, b: est.daysInMonth }) : undefined} />
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-2">{t("Invoices")}</h2>
        <div className="overflow-x-auto"><table className="table">
          <thead><tr><th>{t("Month")}</th><th className="text-right">{t("Active students")}</th><th className="text-right">{t("Amount")}</th><th>{t("Status")}</th></tr></thead>
          <tbody>{invoices.map((i) => <tr key={i.id}><td>{i.period}</td><td className="text-right">{i.activeStudents}</td><td className="text-right">{money(i.amountCts, "pln")}</td><td>{i.inTrial ? <Pill v="trial">{t("free trial")}</Pill> : <Pill v={i.paidAt ? "paid" : "unpaid"} />}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>
  );
}
