import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Stat } from "@/components/ui";
import { AssistantCard } from "@/components/Assistant";
import { money } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export default async function Dashboard() {
  const t = await getT();
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
      <PageHeader title={t("Welcome, {name}", { name: user.name.split(" ")[0] })} sub={club.name} />
      {isAdmin && <AssistantCard />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("Active students")} value={active} hint={t("{n} inactive", { n: inactive })} />
        <Stat label={t("Groups")} value={groups} />
        {isAdmin && <Stat label={t("New inquiries")} value={<Link href="/admin/inbox" className="text-brand">{newSubs}</Link>} />}
        {isAdmin && <Stat label={t("Overdue tuition")} value={money(overdue._sum.amountCts ?? 0, club.currency)} hint={t("{n} invoices", { n: overdue._count })} />}
        {isAdmin && <Stat label={t("Open shop orders")} value={<Link href="/admin/orders" className="text-brand">{openOrders}</Link>} />}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("Top XP this club")}</h2>
        <table className="table">
          <thead><tr><th>{t("Student")}</th><th>{t("Group")}</th><th className="text-right">{t("XP")}</th></tr></thead>
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
