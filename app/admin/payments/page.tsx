import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Empty, Tabs } from "@/components/ui";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { CopyLink } from "@/components/CopyLink";
import { money, monthKey, str, fmtDate } from "@/lib/format";
import { generateMonthly, sendFeeToParents, payUrl } from "@/lib/fees";
import { emailEnabled } from "@/lib/email";
import { stripeEnabled, stripeStatus } from "@/lib/stripe";
import { getT } from "@/lib/i18n/server";

async function generate(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const period = str(fd.get("period"));
  if (!/^\d{4}-\d{2}$/.test(period)) return { ok: false, message: t("Choose a month.") };
  const n = await generateMonthly(clubId, period, Number(fd.get("dueDay")) || 10);
  revalidatePath("/admin/payments");
  return { ok: true, message: t("{n} new payment requests created for {period}.", { n, period }) };
}

async function sendOne(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const r = await sendFeeToParents(str(fd.get("id")), clubId);
  revalidatePath("/admin/payments");
  if (r.noEmail) return { ok: false, message: t("No parent email on file. Copy the link instead.") };
  return r.sent ? { ok: true, message: t("Sent to {n} parent(s).", { n: r.sent }) } : { ok: false, message: t("Nothing to send.") };
}

async function sendAll(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const period = str(fd.get("period"));
  const fees = await db.feeInvoice.findMany({ where: { clubId, period, paidAt: null, sentAt: null }, select: { id: true } });
  let sent = 0, missing = 0;
  for (const f of fees) {
    const r = await sendFeeToParents(f.id, clubId);
    if (r.sent) sent++; else if (r.noEmail) missing++;
  }
  revalidatePath("/admin/payments");
  return { ok: true, message: t("Sent {a} payment requests. Without parent email: {b}.", { a: sent, b: missing }) };
}

async function markPaid(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const paid = str(fd.get("paid")) === "1";
  await db.feeInvoice.updateMany({ where: { id: str(fd.get("id")), clubId }, data: paid ? { paidAt: new Date(), method: str(fd.get("method")) || "cash" } : { paidAt: null, method: null } });
  revalidatePath("/admin/payments");
}

async function remove(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  await db.feeInvoice.deleteMany({ where: { id: str(fd.get("id")), clubId, paidAt: null } });
  revalidatePath("/admin/payments");
}

export default async function Payments({ searchParams }: { searchParams: Promise<{ period?: string; view?: string }> }) {
  const t = await getT();
  const { clubId, club } = await requireStaff(true);
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? "") ? sp.period! : monthKey();
  const view = sp.view ?? "all";
  const now = new Date();
  const invoices = await db.feeInvoice.findMany({
    where: { clubId, period, ...(view === "unpaid" ? { paidAt: null } : view === "overdue" ? { paidAt: null, dueDate: { lt: now } } : view === "unsent" ? { paidAt: null, sentAt: null } : {}) },
    include: { student: { include: { group: true, parents: { include: { parent: true } } } } },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });
  const all = await db.feeInvoice.findMany({ where: { clubId, period }, select: { amountCts: true, paidAt: true, sentAt: true } });
  const total = all.reduce((a, i) => a + i.amountCts, 0);
  const paid = all.filter((i) => i.paidAt).reduce((a, i) => a + i.amountCts, 0);
  const unsent = all.filter((i) => !i.paidAt && !i.sentAt).length;
  const q = (v: string) => `/admin/payments?period=${period}&view=${v}`;
  const stripe = await stripeStatus();

  return (
    <div>
      <PageHeader title={t("Tuition payments")} sub={t("Create payment requests from price plans and send parents a link to pay online.")}>
        <Link href="/admin/plans" className="btn-secondary">{t("Price plans")}</Link>
      </PageHeader>

      {stripe && (
        <div className={`mb-4 rounded-card p-3 text-sm ${stripe.ok && stripe.chargesEnabled ? "bg-mint text-forest" : "bg-red-50 text-red-900"}`} role="status">
          {stripe.ok
            ? <>{stripe.chargesEnabled ? "✓ " : "⚠ "}{t("Stripe connected")} · <strong>{stripe.mode === "test" ? t("test mode (sandbox)") : t("live mode")}</strong>{stripe.name ? ` · ${stripe.name}` : ""}{stripe.country ? ` · ${stripe.country}` : ""}{!stripe.chargesEnabled && ` · ${t("this Stripe account cannot accept payments yet: finish the account setup in Stripe.")}`}</>
            : <>⚠ {t("Stripe error")}: {stripe.reason}</>}
        </div>
      )}
      {(!stripeEnabled() || !emailEnabled()) && (
        <div className="mb-4 rounded-card bg-[#FFF8D6] p-3 text-sm text-ink">
          {!stripeEnabled() && <p>⚠ {t("Online payment is off: add STRIPE_SECRET_KEY in Vercel. Parents will see bank-transfer details or 'pay at the club'.")}</p>}
          {!emailEnabled() && <p>⚠ {t("Email is off: add RESEND_API_KEY and EMAIL_FROM in Vercel. Until then use 'Copy link' and send it by WhatsApp or SMS.")}</p>}
        </div>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">{t("1. Create payment requests")}</h2>
          <form className="mb-3 flex flex-wrap items-end gap-2"><Field label={t("Month")}><input className="input" type="month" name="period" defaultValue={period} /></Field><button className="btn-secondary">{t("Show")}</button></form>
          <ActionForm action={generate} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="period" value={period} />
            <Field label={t("Due day")}><input className="input w-24" type="number" name="dueDay" defaultValue={10} min={1} max={28} /></Field>
            <button className="btn">{t("Create requests for {period}", { period })}</button>
          </ActionForm>
          <p className="muted mt-2">{t("Monthly plans, or the group's monthly fee for students without a plan. Semester and one-off plans are issued on the Price plans page.")}</p>
        </div>
        <div className="card">
          <h2 className="h2 mb-3">{t("2. Send to parents")}</h2>
          <p className="text-ink">{t("{paid} collected of {total}", { paid: money(paid, club.currency), total: money(total, club.currency) })}</p>
          <p className="muted mb-3">{t("Not sent yet: {n}", { n: unsent })}</p>
          <ActionForm action={sendAll}>
            <input type="hidden" name="period" value={period} />
            <button className="btn" disabled={unsent === 0}>{t("Send all unsent ({n})", { n: unsent })}</button>
          </ActionForm>
        </div>
      </div>

      <Tabs active={view} items={[
        { key: "all", label: t("All"), href: q("all") }, { key: "unsent", label: t("Not sent"), href: q("unsent") },
        { key: "unpaid", label: t("Unpaid"), href: q("unpaid") }, { key: "overdue", label: t("Overdue"), href: q("overdue") },
      ]} />
      {invoices.length === 0 ? <Empty>{t("No invoices for {period}. Generate them above.", { period })}</Empty> : (
        <ul className="space-y-2">
          {invoices.map((i) => {
            const parentNames = i.student.parents.map((p) => p.parent.firstName).join(", ");
            return (
              <li key={i.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{i.student.firstName} {i.student.lastName} <span className="muted font-normal">· {i.student.group?.name ?? "—"}</span></div>
                  <div className="muted">{i.title ?? t("Club fee")} · {t("Due")} {fmtDate(i.dueDate)}{parentNames ? ` · ${t("Parent")}: ${parentNames}` : ` · ${t("no parent")}`}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Pill v={i.paidAt ? "paid" : i.dueDate < now ? "overdue" : "unpaid"} />
                    {i.method && <span className="muted">{t(`method:${i.method}`)}</span>}
                    {!i.paidAt && (i.sentAt ? <span className="pill pill-blue">{t("sent {date}", { date: fmtDate(i.sentAt) })}</span> : <span className="pill">{t("not sent")}</span>)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="font-display text-xl font-semibold text-forest">{money(i.amountCts, club.currency)}</div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {!i.paidAt && <ActionForm action={sendOne}><input type="hidden" name="id" value={i.id} /><button className="btn btn-sm">{i.sentAt ? t("Send again") : t("Send to parent")}</button></ActionForm>}
                    {!i.paidAt && <CopyLink url={payUrl(i.payToken)} label={t("Copy link")} done={t("Copied ✓")} />}
                    <a className="btn-secondary btn-sm" href={`/pay/${i.payToken}`} target="_blank" rel="noreferrer">{t("Open")}</a>
                  </div>
                  <form action={markPaid} className="flex flex-wrap justify-end gap-1">
                    <input type="hidden" name="id" value={i.id} />
                    {i.paidAt ? (<><input type="hidden" name="paid" value="0" /><button className="btn-secondary btn-sm">{t("Undo")}</button></>) : (
                      <><input type="hidden" name="paid" value="1" />
                        <select name="method" className="input w-auto py-1" aria-label={t("Payment method")}><option value="cash">{t("method:cash")}</option><option value="transfer">{t("method:transfer")}</option><option value="card">{t("method:card")}</option></select>
                        <button className="btn-secondary btn-sm">{t("Mark paid")}</button></>
                    )}
                  </form>
                  {!i.paidAt && <form action={remove}><input type="hidden" name="id" value={i.id} /><button className="text-xs text-red-700 underline">{t("Delete request")}</button></form>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
