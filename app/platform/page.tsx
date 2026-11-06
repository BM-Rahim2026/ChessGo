import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { clubOverview, issuePlatformInvoices } from "@/lib/platform";
import { PageHeader, Stat, Pill, Field } from "@/components/ui";
import { money, monthKey, str, fmtDate } from "@/lib/format";
import { trialDaysLeft } from "@/lib/billing";
import { getT } from "@/lib/i18n/server";

async function issue(fd: FormData) {
  "use server";
  const t = await getT();
  await requireRole("platform_admin");
  const period = str(fd.get("period"));
  if (/^\d{4}-\d{2}$/.test(period)) await issuePlatformInvoices(period);
  revalidatePath("/platform");
}

export default async function Platform({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const t = await getT();
  await requireRole("platform_admin");
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? "") ? sp.period! : monthKey();
  const rows = await clubOverview(period);
  const totalActive = rows.reduce((a, r) => a + r.active, 0);
  const mrr = rows.reduce((a, r) => a + r.fee.amountCts, 0);
  const trials = rows.filter((r) => trialDaysLeft(r.club.trialEndsAt) > 0).length;
  return (
    <div>
      <PageHeader title={t("Clubs & billing")} sub={t("Per active student per month, clamped between each club's minimum and maximum. New clubs get a 30-day free trial; the month it ends in is prorated.")}>
        <a className="btn-secondary" href={`/api/platform/billing.csv?period=${period}`}>⬇ CSV</a>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label={t("Clubs")} value={rows.length} hint={t("{n} in trial", { n: trials })} />
        <Stat label={t("Active students")} value={totalActive} />
        <Stat label={t("Billing {period}", { period })} value={money(mrr, "pln")} />
        <Stat label={t("Invoices issued")} value={`${rows.filter((r) => r.invoice).length}/${rows.length}`} />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <form className="flex items-end gap-2"><Field label={t("Month")}><input className="input" type="month" name="period" defaultValue={period} /></Field><button className="btn-secondary">{t("Show")}</button></form>
        <form action={issue}><input type="hidden" name="period" value={period} /><button className="btn">{t("Issue / refresh invoices for {period}", { period })}</button></form>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>{t("Club")}</th><th>{t("Status")}</th><th>{t("Trial")}</th><th className="text-right">{t("Active students")}</th><th className="text-right">{t("Rate")}</th><th className="text-right">{t("Raw")}</th><th className="text-right">{t("Min / max")}</th><th className="text-right">{t("Due")} {period}</th><th>{t("Invoice")}</th></tr></thead>
          <tbody>
            {rows.map(({ club: c, active, fee, invoice }) => {
              const left = trialDaysLeft(c.trialEndsAt);
              return (
                <tr key={c.id}>
                  <td><Link className="font-medium text-brand" href={`/platform/clubs/${c.id}`}>{c.name}</Link><div className="muted text-xs">{t("since")} {fmtDate(c.createdAt)}</div></td>
                  <td><Pill v={c.billingStatus} /></td>
                  <td className="text-sm">{left > 0 ? t("{n} days left", { n: left }) : t("ended {date}", { date: fmtDate(c.trialEndsAt) })}</td>
                  <td className="text-right tabular-nums">{active}</td>
                  <td className="text-right tabular-nums">{money(c.pricePerStudentCts, "pln")}</td>
                  <td className="text-right tabular-nums">{money(fee.rawCts, "pln")}</td>
                  <td className="text-right tabular-nums text-ink-soft">{money(c.minMonthlyFeeCts, "pln")} / {money(c.maxMonthlyFeeCts, "pln")}</td>
                  <td className="text-right font-medium tabular-nums">{money(fee.amountCts, "pln")}{fee.billableDays > 0 && fee.billableDays < fee.daysInMonth && <div className="muted text-xs">{fee.billableDays}/{fee.daysInMonth} {t("days")}</div>}{fee.inTrial && <div className="muted text-xs">{t("status:trial")}</div>}</td>
                  <td>{invoice ? <Pill v={invoice.inTrial ? "trial" : invoice.paidAt ? "paid" : "unpaid"}>{invoice.inTrial ? t("free") : invoice.paidAt ? t("status:paid") : money(invoice.amountCts, "pln")}</Pill> : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
