import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalContext } from "@/lib/portal";
import { syncCheckout, cancelOrder } from "@/lib/shop";
import { PageHeader, Pill, Empty } from "@/components/ui";
import { money, fmtDate, str } from "@/lib/format";

async function cancel(fd: FormData) {
  "use server";
  const { parent } = await portalContext();
  if (!parent) redirect("/portal");
  const o = await db.order.findFirst({ where: { id: str(fd.get("id")), parentId: parent.id, paymentStatus: "unpaid", status: "pending" } });
  if (o) await cancelOrder(o.id);
  redirect("/portal/orders");
}

export default async function MyOrders({ searchParams }: { searchParams: Promise<{ placed?: string; paid?: string; session_id?: string; cancelled?: string }> }) {
  const { parent, club } = await portalContext();
  if (!parent) redirect("/portal");
  const sp = await searchParams;
  // Confirm payment on return from Stripe, even before the webhook lands.
  if (sp.session_id) {
    const own = await db.order.findFirst({ where: { stripeSessionId: sp.session_id, parentId: parent.id } });
    if (own) await syncCheckout(sp.session_id).catch(() => null);
  }
  if (sp.cancelled) {
    const o = await db.order.findFirst({ where: { id: sp.cancelled, parentId: parent.id, paymentMethod: "stripe", paymentStatus: "unpaid" } });
    if (o) await cancelOrder(o.id);
  }
  const orders = await db.order.findMany({ where: { parentId: parent.id }, include: { lines: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="My orders" />
      {sp.placed && <p className="mb-4 rounded-control bg-mint p-3 text-sm text-forest">Order placed! Pay and collect it at the club.</p>}
      {sp.paid && <p className="mb-4 rounded-control bg-mint p-3 text-sm text-forest">Thank you, payment received. We&apos;ll tell you when it&apos;s ready to collect.</p>}
      {sp.cancelled && <p className="mb-4 rounded-control bg-amber-50 p-3 text-sm text-amber-900">Payment cancelled; the order was cancelled.</p>}
      {orders.length === 0 ? <Empty>No orders yet.</Empty> : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">Order #{o.id.slice(-6).toUpperCase()} <span className="muted font-normal">· {fmtDate(o.createdAt)}</span></div>
                  <ul className="mt-1 text-sm">{o.lines.map((l) => <li key={l.id}>{l.qty} × {l.name}</li>)}</ul>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(o.totalCts, club.currency)}</div>
                  <div className="mt-1 flex gap-1"><Pill v={o.paymentStatus} /><Pill v={o.status}>{o.status === "ready" ? "ready to collect" : o.status}</Pill></div>
                </div>
              </div>
              {o.status === "pending" && o.paymentStatus === "unpaid" && (
                <form action={cancel} className="mt-2"><input type="hidden" name="id" value={o.id} /><button className="text-xs text-red-600 underline">Cancel order</button></form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
