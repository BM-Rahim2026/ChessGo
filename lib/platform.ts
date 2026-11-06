import "server-only";
import { db } from "./db";
import { monthlyFee } from "./billing";
import { monthKey } from "./format";

export async function clubOverview(period = monthKey()) {
  const clubs = await db.club.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { students: { where: { status: "active" } }, groups: true } }, platformInvoices: { where: { period } } },
  });
  return clubs.map((c) => {
    const fee = monthlyFee({
      activeStudents: c._count.students, pricePerStudentCts: c.pricePerStudentCts, minCts: c.minMonthlyFeeCts, maxCts: c.maxMonthlyFeeCts, period, trialEndsAt: c.trialEndsAt,
    });
    return { club: c, active: c._count.students, groups: c._count.groups, fee, invoice: c.platformInvoices[0] ?? null };
  });
}

/** Snapshot active students and issue (or refresh, if still unpaid) each club's invoice for a month. */
export async function issuePlatformInvoices(period: string) {
  const rows = await clubOverview(period);
  for (const r of rows) {
    if (r.invoice?.paidAt) continue;
    const data = { activeStudents: r.active, rawCts: r.fee.rawCts, amountCts: r.fee.amountCts, inTrial: r.fee.inTrial };
    await db.platformInvoice.upsert({
      where: { clubId_period: { clubId: r.club.id, period } }, update: { ...data, issuedAt: new Date() }, create: { ...data, clubId: r.club.id, period },
    });
  }
}
