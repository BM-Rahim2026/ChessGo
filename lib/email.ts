import "server-only";

/**
 * Send an email via Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without it the message is written to the server log, so nothing breaks in development.
 */
export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/**
 * replyTo: where replies go (e.g. the club's Gmail) — lets the app send from a no-reply domain
 * address without needing a mailbox there. Defaults to EMAIL_REPLY_TO.
 */
export async function sendEmail(to: string, subject: string, text: string, replyTo?: string | null): Promise<boolean> {
  const reply = (replyTo || process.env.EMAIL_REPLY_TO || "").trim() || undefined;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, ...(reply ? { reply_to: reply } : {}) }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}

export { appUrl } from "./appUrl";
