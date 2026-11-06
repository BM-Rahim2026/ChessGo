import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty, Tabs } from "@/components/ui";
import { fmtDate, str, optStr } from "@/lib/format";
import { inboundEnabled, parseAddress, sendFromPanel, type StoredAttachment } from "@/lib/mail";
import { emailEnabled } from "@/lib/email";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

async function send(fd: FormData) {
  "use server";
  const { clubId, club } = await requireStaff(true);
  const replyToId = optStr(fd.get("replyTo"));
  const orig = replyToId ? await db.mailMessage.findFirst({ where: { id: replyToId, clubId } }) : null;
  const to = orig ? orig.fromAddr : parseAddress(str(fd.get("to"))).addr;
  const subject = str(fd.get("subject")).trim() || (orig ? `Re: ${orig.subject.replace(/^re:\s*/i, "")}` : "");
  const text = str(fd.get("text"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || !subject || !text.trim()) redirect(`/admin/mail?${orig ? `id=${orig.id}&` : "new=1&"}err=invalid`);
  const ok = await sendFromPanel({
    clubId, clubName: club.name, to, subject, text,
    mailbox: orig?.mailbox ?? process.env.MAIL_INBOX ?? null, inReplyTo: orig?.messageId ?? null,
  });
  if (!ok) redirect(`/admin/mail?${orig ? `id=${orig.id}&` : "new=1&"}err=send`);
  redirect(orig ? `/admin/mail?id=${orig.id}&sent=1` : "/admin/mail?tab=sent&sent=1");
}

async function setFlag(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const id = str(fd.get("id"));
  const op = str(fd.get("op"));
  if (op === "delete") {
    await db.mailMessage.deleteMany({ where: { id, clubId } });
    redirect("/admin/mail");
  }
  const data = op === "archive" ? { archived: true } : op === "unarchive" ? { archived: false } : op === "unread" ? { readAt: null } : null;
  if (data) await db.mailMessage.updateMany({ where: { id, clubId }, data });
  redirect(op === "unread" || op === "archive" ? "/admin/mail" : `/admin/mail?id=${id}`);
}

function Compose({ t, replyTo, to, subject }: { t: (s: string) => string; replyTo?: string; to?: string; subject?: string }) {
  return (
    <form action={send} className="space-y-2">
      {replyTo && <input type="hidden" name="replyTo" value={replyTo} />}
      {!replyTo && <input className="input" name="to" type="email" required placeholder={t("To (email)")} defaultValue={to} />}
      <input className="input" name="subject" required={!replyTo} placeholder={t("Subject")} defaultValue={subject} />
      <textarea className="input min-h-40" name="text" required placeholder={t("Your message…")} />
      <button className="btn">{t("Send")}</button>
    </form>
  );
}

export default async function Mail({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; new?: string; err?: string; sent?: string }> }) {
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const sp = await searchParams;
  const tab = sp.tab ?? "in";
  const msg = sp.id ? await db.mailMessage.findFirst({ where: { id: sp.id, clubId } }) : null;
  if (msg && msg.direction === "in" && !msg.readAt) await db.mailMessage.update({ where: { id: msg.id }, data: { readAt: new Date() } });

  const where = tab === "sent" ? { direction: "out" } : tab === "archive" ? { direction: "in", archived: true } : { direction: "in", archived: false };
  const [list, unread] = await Promise.all([
    db.mailMessage.findMany({ where: { clubId, ...where }, orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, direction: true, fromAddr: true, fromName: true, toAddrs: true, subject: true, text: true, readAt: true, createdAt: true } }),
    db.mailMessage.count({ where: { clubId, direction: "in", archived: false, readAt: null } }),
  ]);
  const thread = msg?.messageId ? await db.mailMessage.findMany({ where: { clubId, inReplyTo: msg.messageId, direction: "out" }, orderBy: { createdAt: "asc" } }) : [];
  const ready = inboundEnabled() && emailEnabled();

  return (
    <div>
      <PageHeader title={t("Mail")} sub={t("Emails sent to your club address arrive here. Reply straight from the panel.")}>
        <Link className="btn" href="/admin/mail?new=1">{t("New message")}</Link>
      </PageHeader>
      {!ready && (
        <div className="card mb-4 border-l-4 border-go text-sm">
          <b>{t("Mailbox not connected yet.")}</b> {t("To receive mail here, set RESEND_API_KEY, EMAIL_FROM and RESEND_WEBHOOK_SECRET in Vercel and point the domain's MX record to Resend.")}
        </div>
      )}
      {sp.err && <div className="card mb-4 text-sm text-red-700">{sp.err === "send" ? t("Sending failed — check the email settings.") : t("Fill in recipient, subject and message.")}</div>}
      {sp.sent && <div className="card mb-4 text-sm text-forest">{t("Message sent.")}</div>}
      <Tabs active={tab} items={[
        { key: "in", label: `${t("Received mail")}${unread ? ` (${unread})` : ""}`, href: "/admin/mail" },
        { key: "sent", label: t("Sent"), href: "/admin/mail?tab=sent" },
        { key: "archive", label: t("Archived"), href: "/admin/mail?tab=archive" },
      ]} />

      {sp.new && (
        <div className="card mb-4">
          <h2 className="h2 mb-2">{t("New message")}</h2>
          <Compose t={t} />
        </div>
      )}

      {msg && (
        <div className="card mb-4 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="h2 break-words">{msg.subject}</h2>
              <div className="muted break-all text-sm">
                {msg.direction === "in"
                  ? <>{t("From")}: {msg.fromName ? `${msg.fromName} ` : ""}&lt;{msg.fromAddr}&gt; · {t("To")}: {msg.toAddrs}</>
                  : <>{t("To")}: {msg.toAddrs}</>}
                {" · "}{fmtDate(msg.createdAt)} {msg.createdAt.toLocaleTimeString("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {msg.direction === "in" && (msg.archived
                ? <form action={setFlag}><input type="hidden" name="id" value={msg.id} /><input type="hidden" name="op" value="unarchive" /><button className="btn-secondary btn-sm">{t("Move to inbox")}</button></form>
                : <form action={setFlag}><input type="hidden" name="id" value={msg.id} /><input type="hidden" name="op" value="archive" /><button className="btn-secondary btn-sm">{t("Archive")}</button></form>)}
              {msg.direction === "in" && <form action={setFlag}><input type="hidden" name="id" value={msg.id} /><input type="hidden" name="op" value="unread" /><button className="btn-secondary btn-sm">{t("Mark unread")}</button></form>}
              <form action={setFlag}><input type="hidden" name="id" value={msg.id} /><input type="hidden" name="op" value="delete" /><button className="btn-secondary btn-sm">{t("Delete")}</button></form>
            </div>
          </div>
          <div className="mt-3">
            {msg.html
              ? <iframe title={msg.subject} sandbox="" srcDoc={msg.html} className="h-[45vh] w-full rounded-control border border-black/10 bg-white" />
              : <pre className="whitespace-pre-wrap break-words font-sans text-sm">{msg.text ?? t("(no content)")}</pre>}
          </div>
          {((msg.attachments ?? []) as StoredAttachment[]).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {((msg.attachments ?? []) as StoredAttachment[]).map((a) => (
                <a key={a.id} className="btn-secondary btn-sm" href={`/api/mail/attachment?m=${msg.id}&a=${a.id}`} target="_blank" rel="noopener">
                  📎 {a.filename ?? t("Attachment")} ({Math.max(1, Math.round(a.size / 1024))} KB)
                </a>
              ))}
            </div>
          )}
          {thread.map((r) => (
            <div key={r.id} className="mt-4 rounded-control bg-mint p-3 text-sm">
              <div className="muted mb-1">{t("Your reply")} · {fmtDate(r.createdAt)}</div>
              <pre className="whitespace-pre-wrap break-words font-sans">{r.text}</pre>
            </div>
          ))}
          {msg.direction === "in" && (
            <div className="mt-4 border-t border-black/10 pt-4">
              <h3 className="mb-2 font-semibold">{t("Reply to")} {msg.fromAddr}</h3>
              <Compose t={t} replyTo={msg.id} subject={`Re: ${msg.subject.replace(/^re:\s*/i, "")}`} />
            </div>
          )}
        </div>
      )}

      {list.length === 0 ? <Empty>{t("No messages.")}</Empty> : (
        <div className="card divide-y divide-black/5 p-0">
          {list.map((m) => (
            <Link key={m.id} href={`/admin/mail?${tab !== "in" ? `tab=${tab}&` : ""}id=${m.id}`}
              className={`flex min-w-0 items-baseline gap-3 px-4 py-3 hover:bg-mint ${m.id === msg?.id ? "bg-mint" : ""}`}>
              <span className={`w-2 shrink-0 ${m.direction === "in" && !m.readAt ? "text-chess" : "text-transparent"}`}>●</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${m.direction === "in" && !m.readAt ? "font-semibold" : ""}`}>
                  {m.direction === "in" ? (m.fromName || m.fromAddr) : `${t("To")}: ${m.toAddrs}`}
                </span>
                <span className="block truncate text-sm">{m.subject}<span className="muted"> — {(m.text ?? "").replace(/\s+/g, " ").slice(0, 120)}</span></span>
              </span>
              <span className="muted shrink-0 text-xs">{fmtDate(m.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
