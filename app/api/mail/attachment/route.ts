import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentUrl } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { clubId } = await requireStaff(true);
  const u = new URL(req.url);
  const msg = await db.mailMessage.findFirst({ where: { id: u.searchParams.get("m") ?? "", clubId, direction: "in" } });
  const att = u.searchParams.get("a") ?? "";
  const list = (msg?.attachments ?? []) as { id: string }[];
  if (!msg?.resendId || !list.some((a) => a.id === att)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.redirect(await attachmentUrl(msg.resendId, att));
}
