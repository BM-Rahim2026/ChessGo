import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assistantEnabled, runAssistant, toView, type AssistantEvent } from "@/lib/assistant/run";
import type Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // tool loops can take a while

/** Club admins only (the assistant can create content and award XP). */
async function admin() {
  const u = await currentUser();
  if (!u || u.mustChangePassword || u.role !== "club_admin" || !u.clubId || !u.club) return null;
  return u;
}

// GET ?chat=<id> → that chat's messages; otherwise the list of the admin's chats.
export async function GET(req: Request) {
  const u = await admin();
  if (!u) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("chat");
  if (id) {
    const chat = await db.assistantChat.findFirst({ where: { id, clubId: u.clubId!, userId: u.id } });
    if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: chat.id, title: chat.title, items: toView(chat.messages as unknown as Anthropic.Beta.BetaMessageParam[]) });
  }
  const chats = await db.assistantChat.findMany({
    where: { clubId: u.clubId!, userId: u.id }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, title: true, updatedAt: true },
  });
  return NextResponse.json({ enabled: assistantEnabled(), chats });
}

// POST {chatId?, text} → NDJSON stream of AssistantEvent lines.
export async function POST(req: Request) {
  const u = await admin();
  if (!u) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!assistantEnabled()) return NextResponse.json({ error: "Assistant not configured" }, { status: 501 });
  const body = (await req.json().catch(() => ({}))) as { chatId?: string; text?: string };
  const text = String(body.text ?? "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AssistantEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      await runAssistant({ clubId: u.clubId!, clubName: u.club!.name, userId: u.id, chatId: body.chatId ?? null, text, emit });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}

// DELETE ?chat=<id> → remove one of the admin's own conversations.
export async function DELETE(req: Request) {
  const u = await admin();
  if (!u) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("chat") ?? "";
  await db.assistantChat.deleteMany({ where: { id, clubId: u.clubId!, userId: u.id } });
  return NextResponse.json({ ok: true });
}
