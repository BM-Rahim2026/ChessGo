import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { startFeeCheckout } from "@/lib/fees";
import { syncCheckout } from "@/lib/shop";
import { stripeEnabled, logStripeError } from "@/lib/stripe";
import { Logo } from "@/components/Brand";
import { Feedback } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";
import { money, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

async function pay(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  let url: string;
  try {
    url = await startFeeCheckout(token);
  } catch (e) {
    logStripeError("fee-checkout", e);
    redirect(`/pay/${token}?error=1`);
  }
  redirect(url);
}

export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ session_id?: string; error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{32,96}$/.test(token)) notFound();
  // Returning from Stripe: confirm immediately (the webhook does the same in the background).
  if (sp.session_id) {
    const own = await db.feeInvoice.findFirst({ where: { payToken: token, stripeSessionId: sp.session_id } });
    if (own) await syncCheckout(sp.session_id).catch(() => null);
  }
  const fee = await db.feeInvoice.findUnique({ where: { payToken: token }, include: { club: true, student: { select: { firstName: true } } } });
  if (!fee) notFound();
  const locale = await getLocale();
  const t = makeT(locale);
  const overdue = !fee.paidAt && fee.dueDate < new Date();
  const online = stripeEnabled();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Logo width={180} className="-ml-[13px]" />
        <LanguageSwitch locale={locale} />
      </div>
      <div className="card-learner mt-4">
        <p className="muted">{fee.club.name}</p>
        <h1 className="h1 mt-1">{fee.title ?? t("Club fee")}</h1>
        <dl className="mt-5 space-y-2 text-[15px]">
          <div className="flex justify-between gap-4"><dt className="text-ink-soft">{t("Student")}</dt><dd className="font-semibold">{fee.student.firstName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-ink-soft">{t("Period")}</dt><dd className="font-semibold">{fee.period}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-ink-soft">{t("Due date")}</dt><dd className={`font-semibold ${overdue ? "text-red-800" : ""}`}>{fmtDate(fee.dueDate)}{overdue ? ` · ${t("status:overdue")}` : ""}</dd></div>
          <div className="flex items-baseline justify-between gap-4 border-t border-ink/10 pt-3"><dt className="text-ink-soft">{t("Amount")}</dt><dd className="font-display text-3xl font-semibold text-forest">{money(fee.amountCts, fee.club.currency)}</dd></div>
        </dl>

        <div className="mt-6">
          {fee.paidAt ? (
            <Feedback title={t("Paid. Thank you!")}>{t("Payment received on {date}.", { date: fmtDate(fee.paidAt) })}</Feedback>
          ) : (
            <>
              {sp.error && <p className="mb-3 rounded-control bg-red-50 p-3 text-sm text-red-800">{t("Online payment is not available right now. Please try again later or use a bank transfer.")}</p>}
              {online && (
                <form action={pay}>
                  <input type="hidden" name="token" value={token} />
                  <button className="btn btn-lg w-full">{t("Pay online")}</button>
                  <p className="muted mt-2 text-center">{t("BLIK, Przelewy24 or card · secure payment by Stripe")}</p>
                </form>
              )}
              {fee.club.paymentInfo && (
                <div className={`${online ? "mt-6" : ""} rounded-card bg-mint p-4`}>
                  <div className="font-semibold text-forest">{online ? t("Or pay by bank transfer") : t("Pay by bank transfer")}</div>
                  <p className="mt-1 whitespace-pre-line text-ink">{fee.club.paymentInfo}</p>
                  <p className="muted mt-2">{t("Title of transfer")}: {fee.student.firstName} – {fee.title ?? t("Club fee")} {fee.period}</p>
                </div>
              )}
              {!online && !fee.club.paymentInfo && <p className="text-ink">{t("Please pay at the club. Questions? Contact the club.")}</p>}
            </>
          )}
        </div>
      </div>
      {fee.club.email && <p className="muted mt-4 text-center">{t("Questions?")} <a className="underline" href={`mailto:${fee.club.email}`}>{fee.club.email}</a></p>}
    </main>
  );
}
