import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { money } from "@/lib/format";

export default async function Dashboard() {
  const { clubId, club, user } = await requireStaff();
  const now = new Date();
  const [active, inactive, groups, newSubs, overdue, openOrders, topXp] = await Promise.all([
    db.student.count({ where: { clubId, status: "active" } }),
    db.student.count({ where: { clubId, status: "inactive" } }),
    db.group.count({ where: { clubId } }),
    db.formSubmission.count({ where: { clubId, status: "new" } }),
    db.feeInvoice.aggregate({ where: { clubId, paidAt: null, dueDate: { lt: now } }, _sum: { amountCts: true }, _count: true }),
    db.order.count({ where: { clubId, status: { in: ["pending", "ready"] } } }),
    db.student.findMany({ where: { clubId, status: "active" }, orderBy: { xp: "desc" }, take: 5, include: { group: true } }),
  ]);
  const isAdmin = user.role === "club_admin";
  return (
    <div>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} sub={club.name} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active students" value={active} hint={`${inactive} inactive`} />
        <Stat label="Groups" value={groups} />
        {isAdmin && <Stat label="New inquiries" value={<Link href="/admin/inbox" className="text-brand">{newSubs}</Link>} />}
        {isAdmin && <Stat label="Overdue tuition" value={money(overdue._sum.amountCts ?? 0, club.currency)} hint={`${overdue._count} invoices`} />}
        {isAdmin && <Stat label="Open shop orders" value={<Link href="/admin/orders" className="text-brand">{openOrders}</Link>} />}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">Top XP this club</h2>
        <table className="table">
          <thead><tr><th>Student</th><th>Group</th><th className="text-right">XP</th></tr></thead>
          <tbody>
            {topXp.map((s) => (
              <tr key={s.id}><td><Link className="text-brand" href={`/admin/students/${s.id}`}>{s.firstName} {s.lastName}</Link></td><td>{s.group?.name ?? "—"}</td><td className="text-right tabular-nums">{s.xp}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
