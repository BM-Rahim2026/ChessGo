import "server-only";
import { db } from "./db";
import { monthKey } from "./format";
import type { Row } from "./csv";

export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 15)));
  return out;
}
function monthBounds(period: string) {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

export async function attendanceTrend(clubId: string, months = 12, groupId?: string): Promise<Row[]> {
  const periods = lastMonths(months);
  const { start } = monthBounds(periods[0]);
  const records = await db.attendance.findMany({
    where: { lesson: { date: { gte: start }, group: { clubId, ...(groupId ? { id: groupId } : {}) } } },
    select: { status: true, lesson: { select: { date: true, id: true } } },
  });
  return periods.map((p) => {
    const rs = records.filter((r) => monthKey(r.lesson.date) === p);
    const attended = rs.filter((r) => r.status === "present" || r.status === "late").length;
    const lessons = new Set(rs.map((r) => r.lesson.id)).size;
    return {
      month: p, lessons, records: rs.length, present: rs.filter((r) => r.status === "present").length,
      late: rs.filter((r) => r.status === "late").length, absent: rs.filter((r) => r.status === "absent").length,
      excused: rs.filter((r) => r.status === "excused").length,
      attendance_rate_pct: rs.length ? Math.round((attended / rs.length) * 1000) / 10 : 0,
    };
  });
}

export async function revenueByMonth(clubId: string, months = 12): Promise<Row[]> {
  const periods = lastMonths(months);
  const { start } = monthBounds(periods[0]);
  const [fees, orders] = await Promise.all([
    db.feeInvoice.findMany({ where: { clubId, paidAt: { gte: start } }, select: { paidAt: true, amountCts: true } }),
    db.order.findMany({ where: { clubId, paymentStatus: "paid", paidAt: { gte: start } }, select: { paidAt: true, totalCts: true } }),
  ]);
  return periods.map((p) => {
    const tuition = fees.filter((f) => monthKey(f.paidAt!) === p).reduce((a, f) => a + f.amountCts, 0);
    const shop = orders.filter((o) => monthKey(o.paidAt!) === p).reduce((a, o) => a + o.totalCts, 0);
    return { month: p, tuition: tuition / 100, shop: shop / 100, total: (tuition + shop) / 100 };
  });
}

export async function overduePayments(clubId: string, now = new Date()): Promise<Row[]> {
  const inv = await db.feeInvoice.findMany({
    where: { clubId, paidAt: null, dueDate: { lt: now } },
    include: { student: { include: { group: true, parents: { include: { parent: true } } } } },
    orderBy: { dueDate: "asc" },
  });
  return inv.map((i) => {
    const p = i.student.parents[0]?.parent;
    return {
      invoice_id: i.id, student: `${i.student.firstName} ${i.student.lastName}`, group: i.student.group?.name ?? "",
      period: i.period, amount: i.amountCts / 100, due_date: i.dueDate.toISOString().slice(0, 10),
      days_overdue: Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000),
      parent: p ? `${p.firstName} ${p.lastName}` : "", parent_email: p?.email ?? "", parent_phone: p?.phone ?? "",
    };
  });
}

/** Active at end of month = joined before end and not left before end. */
export async function retention(clubId: string, months = 12): Promise<Row[]> {
  const students = await db.student.findMany({ where: { clubId }, select: { joinedAt: true, leftAt: true } });
  return lastMonths(months).map((p) => {
    const { start, end } = monthBounds(p);
    const activeAtStart = students.filter((s) => s.joinedAt < start && (!s.leftAt || s.leftAt >= start)).length;
    const active = students.filter((s) => s.joinedAt < end && (!s.leftAt || s.leftAt >= end)).length;
    const joined = students.filter((s) => s.joinedAt >= start && s.joinedAt < end).length;
    const left = students.filter((s) => s.leftAt && s.leftAt >= start && s.leftAt < end).length;
    const inactive = students.filter((s) => s.leftAt && s.leftAt < end).length;
    return {
      month: p, active, inactive, joined, left,
      retention_pct: activeAtStart ? Math.round(((activeAtStart - left) / activeAtStart) * 1000) / 10 : 100,
    };
  });
}

export async function groupFill(clubId: string): Promise<Row[]> {
  const groups = await db.group.findMany({
    where: { clubId }, include: { coach: true, _count: { select: { students: { where: { status: "active" } } } } }, orderBy: { name: "asc" },
  });
  return groups.map((g) => ({
    group: g.name, coach: g.coach?.name ?? "", capacity: g.capacity, active_students: g._count.students,
    free_spots: Math.max(0, g.capacity - g._count.students),
    fill_rate_pct: g.capacity ? Math.round((g._count.students / g.capacity) * 1000) / 10 : 0,
  }));
}

export const REPORTS = {
  attendance: { title: "Attendance trends", fn: attendanceTrend },
  revenue: { title: "Revenue by month", fn: revenueByMonth },
  overdue: { title: "Overdue payments", fn: overduePayments },
  retention: { title: "Student retention", fn: retention },
  "group-fill": { title: "Group fill rate", fn: groupFill },
} as const;
export type ReportKind = keyof typeof REPORTS;
