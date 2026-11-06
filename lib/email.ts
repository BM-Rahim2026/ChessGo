import "server-only";

/**
 * Send an email via Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without it the message is written to the server log, so nothing breaks in development.
 */
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export type SendOptions = {
  to: string | string[];
  subject: string;
  text: string;
  /** where replies go (e.g. the club's Gmail). Defaults to EMAIL_REPLY_TO. */
  replyTo?: string | null;
  /** override the sender, e.g. "ChessGo <kontakt@chessgo.pl>" (must be on the verified domain) */
  from?: string | null;
  headers?: Record<string, string>;
};

/** Low-level send; returns Resend's id on success. */
export async function sendEmailFull(o: SendOptions): Promise<{ ok: boolean; id?: string }> {
  const reply = (o.replyTo || process.env.EMAIL_REPLY_TO || "").trim() || undefined;
  const key = process.env.RESEND_API_KEY?.trim();
  const from = (o.from || process.env.EMAIL_FROM || "").trim();
  if (!key || !from) {
    console.log(`[email not configured] To: ${o.to}\nSubject: ${o.subject}\n\n${o.text}\n`);
    return { ok: false };
  }
  try {
    const res = await fetch(`${(process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: o.to, subject: o.subject, text: o.text,
        ...(reply ? { reply_to: reply } : {}),
        ...(o.headers ? { headers: o.headers } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error", res.status, await res.text());
      return { ok: false };
    }
    const j = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: j.id };
  } catch (e) {
    console.error("[email] send failed", e);
    return { ok: false };
  }
}

/**
 * replyTo: where replies go (e.g. the club's Gmail) — lets the app send from a no-reply domain
 * address without needing a mailbox there. Defaults to EMAIL_REPLY_TO.
 */
export async function sendEmail(to: string, subject: string, text: string, replyTo?: string | null): Promise<boolean> {
  return (await sendEmailFull({ to, subject, text, replyTo })).ok;
}

export { appUrl } from "./appUrl";
