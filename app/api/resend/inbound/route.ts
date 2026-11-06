import { NextResponse } from "next/server";
import { storeInbound, verifyWebhook } from "@/lib/mail";

export const dynamic = "force-dynamic";

type Event = { type: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } };

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.RESEND_API_KEY) return NextResponse.json({ error: "Inbound mail not configured" }, { status: 501 });
  const body = await req.text();
  if (!verifyWebhook(body, req.headers, secret)) return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  const ev = JSON.parse(body) as Event;
  if (ev.type !== "email.received" || !ev.data?.email_id) return NextResponse.json({ ignored: true });
  try {
    const d = ev.data;
    await storeInbound(d.email_id!, { from: d.from ?? "", to: d.to ?? [], subject: d.subject ?? "" });
  } catch (e) {
    console.error("[mail] inbound failed", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Resend retries
  }
  return NextResponse.json({ received: true });
}
