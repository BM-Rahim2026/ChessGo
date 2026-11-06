import { requireStaff } from "@/lib/auth";
import { PageHeader, Bars, Stat } from "@/components/ui";
import { attendanceTrend, revenueByMonth, overduePayments, retention, groupFill } from "@/lib/reports";
import { money } from "@/lib/format";

function Section({ title, kind, children, months }: { title: string; kind: string; children: React.ReactNode; months?: number }) {
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="h2">{title}</h2>
        <a className="btn-secondary btn-sm" href={`/api/reports/${kind}.csv${months ? `?months=${months}` : ""}`}>⬇ CSV</a>
      </div>
      {children}
    </section>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ months?: string }> }) {
  const { clubId, club } = await requireStaff(true);
  const months = [6, 12, 24].includes(Number((await searchParams).months)) ? Number((await searchParams).months) : 12;
  const [att, rev, overdue, ret, fill] = await Promise.all([
    attendanceTrend(clubId, months), revenueByMonth(clubId, months), overduePayments(clubId), retention(clubId, months), groupFill(clubId),
  ]);
  const eur = (n: number) => money(Math.round(n * 100), club.currency);
  const latest = ret[ret.length - 1];
  const overdueTotal = overdue.reduce((a, r) => a + Number(r.amount), 0);
  const revTotal = rev.reduce((a, r) => a + Number(r.total), 0);
  const cap = fill.reduce((a, r) => a + Number(r.capacity), 0);
  const filled = fill.reduce((a, r) => a + Number(r.active_students), 0);

  return (
    <div>
      <PageHeader title="Reports" sub="Every table downloads as CSV (opens in Excel / Google Sheets).">
        {[6, 12, 24].map((m) => <a key={m} href={`/admin/reports?months=${m}`} className={m === months ? "btn btn-sm" : "btn-secondary btn-sm"}>{m} months</a>)}
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active / inactive" value={`${latest?.active ?? 0} / ${latest?.inactive ?? 0}`} />
        <Stat label={`Revenue, ${months} mo`} value={eur(revTotal)} />
        <Stat label="Overdue" value={eur(overdueTotal)} hint={`${overdue.length} invoices`} />
        <Stat label="Overall fill rate" value={`${cap ? Math.round((filled / cap) * 100) : 0}%`} hint={`${filled}/${cap} places`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Attendance trend" kind="attendance" months={months}>
          <Bars rows={att} label="month" value="attendance_rate_pct" max={100} format={(n) => `${n}%`} />
          <p className="muted mt-2">Share of marked students present or late, per month.</p>
        </Section>
        <Section title="Revenue by month" kind="revenue" months={months}>
          <Bars rows={rev} label="month" value="total" format={eur} />
          <p className="muted mt-2">Tuition (by payment date) + paid shop orders.</p>
        </Section>
        <Section title="Student retention" kind="retention" months={months}>
          <table className="table">
            <thead><tr><th>Month</th><th className="text-right">Active</th><th className="text-right">Joined</th><th className="text-right">Left</th><th className="text-right">Retention</th></tr></thead>
            <tbody>{ret.slice().reverse().map((r) => (
              <tr key={String(r.month)}><td>{r.month}</td><td className="text-right">{r.active}</td><td className="text-right text-forest">{Number(r.joined) ? `+${r.joined}` : 0}</td><td className="text-right text-red-700">{Number(r.left) ? `−${r.left}` : 0}</td><td className="text-right">{r.retention_pct}%</td></tr>
            ))}</tbody>
          </table>
        </Section>
        <Section title="Group fill rate" kind="group-fill">
          <Bars rows={fill} label="group" value="fill_rate_pct" max={100} format={(n) => `${n}%`} />
          <table className="table mt-3"><tbody>{fill.map((r) => <tr key={String(r.group)}><td>{r.group}</td><td className="text-right">{r.active_students}/{r.capacity}</td><td className="text-right muted">{r.free_spots} free</td></tr>)}</tbody></table>
        </Section>
        <div className="xl:col-span-2">
          <Section title="Overdue payments" kind="overdue">
            {overdue.length === 0 ? <p className="muted">Nothing overdue. All payments are up to date.</p> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Student</th><th>Group</th><th>Month</th><th className="text-right">Amount</th><th className="text-right">Days late</th><th>Parent</th></tr></thead>
                  <tbody>{overdue.map((r) => (
                    <tr key={String(r.invoice_id)}><td>{r.student}</td><td>{r.group}</td><td>{r.period}</td><td className="text-right">{eur(Number(r.amount))}</td><td className="text-right">{r.days_overdue}</td>
                      <td>{r.parent} {r.parent_email && <a className="text-brand" href={`mailto:${r.parent_email}`}>✉</a>} <span className="muted">{r.parent_phone}</span></td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
