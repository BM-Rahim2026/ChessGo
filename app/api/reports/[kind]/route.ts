import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { REPORTS, type ReportKind } from "@/lib/reports";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const u = await currentUser();
  if (!u || u.role !== "club_admin" || !u.clubId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { kind } = await params;
  const k = kind.replace(/\.csv$/, "") as ReportKind;
  if (!(k in REPORTS)) return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  const months = Math.min(36, Math.max(1, Number(new URL(req.url).searchParams.get("months")) || 12));
  const rows = k === "overdue" || k === "group-fill" ? await REPORTS[k].fn(u.clubId) : await REPORTS[k].fn(u.clubId, months);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${u.club?.slug ?? "club"}-${k}-${date}.csv"` },
  });
}
