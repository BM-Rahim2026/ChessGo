import "server-only";
import crypto from "node:crypto";
import { db } from "./db";
import { sendEmailFull } from "./email";
import { appUrl } from "./appUrl";

/**
 * Club mailbox: emails sent to @chessgo.pl arrive through Resend Inbound (MX → Resend),
 * Resend calls /api/resend/inbound (email.received), we fetch the full message and store it.
 */

export const inboundEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_WEBHOOK_SECRET);

/** "Jan Kowalski <jan@x.pl>" → { name: "Jan Kowalski", addr: "jan@x.pl" } */
export function parseAddress(raw: string): { name: string | null; addr: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, addr: m[2].trim().toLowerCase() };
  return { name: null, addr: raw.trim().toLowerCase() };
}

/** Verify a Standard Webhooks / Svix signature (what Resend uses). */
export function verifyWebhook(body: string, h: Headers, secret: string, toleranceSec = 300): boolean {
  const id = h.get("svix-id") ?? h.get("webhook-id");
  const ts = h.get("svix-timestamp") ?? h.get("webhook-timestamp");
  const sigs = h.get("svix-signature") ?? h.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = Buffer.from(secret.trim().replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((part) => {
    const [ver, sig] = part.split(",");
    if (ver !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

async function resendGet<T>(path: string): Promise<T> {
  const res = await fetch(`${(process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Resend GET ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

type ReceivedEmail = {
  id: string; from: string; to: string[]; cc: string[] | null; reply_to: string[] | null;
  received_for?: string[]; subject: string; html: string | null; text: string | null;
  message_id: string; headers: Record<string, string> | null; created_at: string;
  attachments: { id: string; filename: string | null; size: number; content_type: string }[];
};
export type StoredAttachment = { id: string; filename: string | null; size: number; contentType: string };

/** Which club an inbound message belongs to: recipient = club email, else MAIL_CLUB_SLUG / FEATURED_CLUB_SLUG, else the first club. */
async function clubFor(recipients: string[]) {
  const rcpt = recipients.map((r) => parseAddress(r).addr);
  const clubs = await db.club.findMany({ select: { id: true, slug: true, email: true }, orderBy: { createdAt: "asc" } });
  const byEmail = clubs.find((c) => c.email && rcpt.includes(c.email.trim().toLowerCase()));
  if (byEmail) return byEmail;
  const slug = process.env.MAIL_CLUB_SLUG || process.env.FEATURED_CLUB_SLUG;
  return clubs.find((c) => c.slug === slug) ?? clubs[0] ?? null;
}

/** Store an inbound email (idempotent by Resend id). */
export async function storeInbound(emailId: string, fallback?: { from: string; to: string[]; subject: string }) {
  const existing = await db.mailMessage.findUnique({ where: { resendId: emailId } });
  if (existing?.text != null || existing?.html != null) return existing;
  const e = await resendGet<ReceivedEmail>(`/emails/receiving/${encodeURIComponent(emailId)}`).catch((err) => {
    if (!fallback) throw err;
    console.error("[mail] could not fetch body", err);
    return null;
  });
  const to = e?.to ?? fallback!.to;
  const rcpt = [...to, ...(e?.cc ?? []), ...(e?.received_for ?? [])];
  const club = await clubFor(rcpt);
  if (!club) return null;
  // Reply to the Reply-To address if the sender set one.
  const from = parseAddress(e?.reply_to?.[0] ?? e?.from ?? fallback!.from);
  const sender = parseAddress(e?.from ?? fallback!.from);
  const data = {
    clubId: club.id,
    direction: "in",
    messageId: e?.message_id ?? null,
    inReplyTo: e?.headers?.["in-reply-to"] ?? e?.headers?.["In-Reply-To"] ?? null,
    fromAddr: from.addr,
    fromName: sender.name,
    toAddrs: to.join(", "),
    ccAddrs: e?.cc?.length ? e.cc.join(", ") : null,
    mailbox: parseAddress(e?.received_for?.[0] ?? to[0] ?? "").addr || null,
    subject: (e?.subject ?? fallback!.subject) || "(bez tematu)",
    text: e?.text ?? null,
    html: e?.html ?? null,
    attachments: (e?.attachments ?? []).map((a) => ({ id: a.id, filename: a.filename, size: a.size, contentType: a.content_type })),
  };
  const msg = await db.mailMessage.upsert({ where: { resendId: emailId }, create: { resendId: emailId, ...data }, update: data });
  if (!existing) await notify(msg.subject, data.fromName ?? data.fromAddr, rcpt);
  if (!e) throw new Error("body fetch failed — stored headers only, will retry");
  return msg;
}

/** Optional heads-up to a personal address (MAIL_NOTIFY_TO), without the content. */
async function notify(subject: string, from: string, rcpt: string[]) {
  const to = process.env.MAIL_NOTIFY_TO?.trim();
  if (!to || rcpt.some((r) => parseAddress(r).addr === to.toLowerCase())) return;
  await sendEmailFull({
    to,
    subject: `Nowa wiadomość w panelu: ${subject}`.slice(0, 200),
    text: `Od: ${from}\nTemat: ${subject}\n\nPrzeczytaj i odpowiedz w panelu: ${appUrl()}/admin/mail`,
  });
}

/** Sender for outgoing mail: the mailbox the message came to if it is on the EMAIL_FROM domain. */
export function senderFor(clubName: string, mailbox: string | null): string | null {
  const from = process.env.EMAIL_FROM ?? "";
  const domain = parseAddress(from).addr.split("@")[1];
  if (mailbox && domain && mailbox.endsWith(`@${domain}`)) return `${clubName.replace(/[<>"]/g, "")} <${mailbox}>`;
  return null; // default EMAIL_FROM
}

export async function sendFromPanel(o: {
  clubId: string; clubName: string; to: string; subject: string; text: string;
  mailbox: string | null; inReplyTo?: string | null;
}) {
  const from = senderFor(o.clubName, o.mailbox);
  const replyTo = o.mailbox || process.env.MAIL_INBOX || null;
  const headers = o.inReplyTo ? { "In-Reply-To": o.inReplyTo, References: o.inReplyTo } : undefined;
  const r = await sendEmailFull({ to: o.to, subject: o.subject, text: o.text, from, replyTo, headers });
  if (!r.ok) return false;
  await db.mailMessage.create({
    data: {
      clubId: o.clubId, direction: "out", resendId: r.id ?? null, inReplyTo: o.inReplyTo ?? null,
      fromAddr: parseAddress(from ?? process.env.EMAIL_FROM ?? "").addr, toAddrs: o.to,
      mailbox: o.mailbox, subject: o.subject, text: o.text, readAt: new Date(),
    },
  });
  return true;
}

/** Short-lived download URL for an inbound attachment. */
export async function attachmentUrl(emailId: string, attachmentId: string): Promise<string> {
  const a = await resendGet<{ download_url: string }>(
    `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return a.download_url;
}
