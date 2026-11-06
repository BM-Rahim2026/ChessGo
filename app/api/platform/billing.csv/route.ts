import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { clubOverview } from "@/lib/platform";
import { toCsv } from "@/lib/csv";
import { monthKey } from "@/lib/format";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "platform_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = new URL(req.url).searchParams.get("period") ?? "";
  const period = /^\d{4}-\d{2}$/.test(p) ? p : monthKey();
  const rows = (await clubOverview(period)).map((r) => ({
    period, club: r.club.name, slug: r.club.slug, status: r.club.billingStatus, trial_ends: r.club.trialEndsAt.toISOString().slice(0, 10),
    active_students: r.active, price_per_student: r.club.pricePerStudentCts / 100, raw: r.fee.rawCts / 100,
    min: r.club.minMonthlyFeeCts / 100, max: r.club.maxMonthlyFeeCts / 100, billable_days: r.fee.billableDays, amount_due: r.fee.amountCts / 100,
    invoice_status: r.invoice ? (r.invoice.inTrial ? "trial" : r.invoice.paidAt ? "paid" : "unpaid") : "not issued",
  }));
  return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="chessgo-billing-${period}.csv"` } });
}
