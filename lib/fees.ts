import "server-only";
import { randomBytes } from "crypto";
import { db } from "./db";
import { appUrl, sendEmail } from "./email";
import { getStripe } from "./stripe";
import { makeT, DEFAULT_LOCALE } from "./i18n/core";

export const INTERVALS = ["month", "semester", "year", "once"] as const;
export type Interval = (typeof INTERVALS)[number];

export const newPayToken = () => randomBytes(24).toString("hex");
export const payUrl = (token: string) => `${appUrl()}/pay/${token}`;

function dueDateFor(period: string, dueDay: number) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, Math.min(28, Math.max(1, dueDay)), 21, 59)); // ~23:59 Warsaw
}

/** Create a payment request unless the same one already exists. Returns true if created. */
async function createFee(d: { clubId: string; studentId: string; period: string; amountCts: number; dueDate: Date; title: string | null; planId: string | null }) {
  const dedupeKey = `${d.studentId}:${d.period}:${d.planId ?? "group"}`;
  const exists = await db.feeInvoice.findUnique({ where: { dedupeKey } });
  if (exists) return false;
  await db.feeInvoice.create({ data: { ...d, dedupeKey, payToken: newPayToken() } });
  return true;
}

/**
 * Monthly run: every active student gets one request for the month —
 * from their monthly plan if they have one, otherwise from their group's monthly fee.
 * Semester / yearly / one-off plans are issued separately (issuePlan).
 */
export async function generateMonthly(clubId: string, period: string, dueDay: number) {
  const students = await db.student.findMany({ where: { clubId, status: "active" }, include: { group: true, plan: true } });
  let created = 0;
  for (const s of students) {
    const due = dueDateFor(period, dueDay);
    if (s.plan) {
      if (!s.plan.active || s.plan.interval !== "month") continue;
      if (await createFee({ clubId, studentId: s.id, period, amountCts: s.plan.priceCts, dueDate: due, title: s.plan.name, planId: s.plan.id })) created++;
    } else if (s.group && s.group.monthlyFeeCts > 0) {
      if (await createFee({ clubId, studentId: s.id, period, amountCts: s.group.monthlyFeeCts, dueDate: due, title: null, planId: null })) created++;
    }
  }
  return created;
}

/** Issue a request for one plan to every active student on it (any interval). */
export async function issuePlan(clubId: string, planId: string, period: string, dueDate: Date) {
  const plan = await db.plan.findFirst({ where: { id: planId, clubId } });
  if (!plan) return 0;
  const students = await db.student.findMany({ where: { clubId, planId, status: "active" } });
  let created = 0;
  for (const s of students) {
    if (await createFee({ clubId, studentId: s.id, period, amountCts: plan.priceCts, dueDate, title: plan.name, planId: plan.id })) created++;
  }
  return created;
}

/** Email the payment link to the student's parents (in Polish, the default language). */
export async function sendFeeToParents(feeId: string, clubId: string) {
  const fee = await db.feeInvoice.findFirst({
    where: { id: feeId, clubId },
    include: { club: true, student: { include: { parents: { include: { parent: true } } } } },
  });
  if (!fee || fee.paidAt) return { sent: 0, noEmail: false };
  const emails = [...new Set(fee.student.parents.map((p) => p.parent.email).filter(Boolean))];
  if (!emails.length) return { sent: 0, noEmail: true };
  const t = makeT(DEFAULT_LOCALE);
  const amount = new Intl.NumberFormat("pl-PL", { style: "currency", currency: fee.club.currency.toUpperCase() }).format(fee.amountCts / 100);
  const due = fee.dueDate.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
  const subject = `${fee.club.name}: ${t("Club fees are due on {date}.", { date: due })}`;
  const body =
    `Dzień dobry,\n\n` +
    `${fee.title ?? "Opłata za zajęcia"} – ${fee.student.firstName} (${fee.period})\n` +
    `Kwota: ${amount}\nTermin płatności: ${due}\n\n` +
    `Zapłać online (BLIK, Przelewy24 lub karta):\n${payUrl(fee.payToken)}\n\n` +
    (fee.club.paymentInfo ? `Możesz też zapłacić przelewem:\n${fee.club.paymentInfo}\n\n` : "") +
    `Pytania? Odpowiedz na tę wiadomość lub napisz do klubu${fee.club.email ? `: ${fee.club.email}` : ""}.\n\n${fee.club.name}\n`;
  for (const to of emails) await sendEmail(to, subject, body);
  await db.feeInvoice.update({ where: { id: fee.id }, data: { sentAt: new Date() } });
  return { sent: emails.length, noEmail: false };
}

/** Start a Stripe Checkout for one payment request; returns the Checkout URL. */
export async function startFeeCheckout(token: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const fee = await db.feeInvoice.findUnique({ where: { payToken: token }, include: { club: true, student: { include: { parents: { include: { parent: true } } } } } });
  if (!fee || fee.paidAt) throw new Error("Not payable");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: [fee.student.parents[0]?.parent.email].find((e) => e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) || undefined,
    locale: "auto",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: fee.club.currency,
        unit_amount: fee.amountCts,
        product_data: { name: `${fee.title ?? "Opłata za zajęcia"} – ${fee.student.firstName} (${fee.period})`, description: fee.club.name },
      },
    }],
    metadata: { feeId: fee.id, clubId: fee.clubId },
    success_url: `${appUrl()}/pay/${token}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/pay/${token}`,
  });
  await db.feeInvoice.update({ where: { id: fee.id }, data: { stripeSessionId: session.id } });
  return session.url!;
}
