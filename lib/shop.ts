import "server-only";
import { db } from "./db";
import { getStripe } from "./stripe";

export type CartLine = { variantId: string; qty: number };

export class StockError extends Error {
  constructor(message: string, public vars?: Record<string, string | number>) { super(message); }
}

/** Create an order and reserve stock atomically. */
export async function placeOrder(clubId: string, parentId: string, lines: CartLine[], paymentMethod: "stripe" | "at_club", note?: string | null) {
  const clean = lines.filter((l) => l.qty > 0 && l.qty <= 20);
  if (!clean.length) throw new StockError("Your cart is empty.");
  return db.$transaction(async (tx) => {
    let total = 0;
    const data: { variantId: string; name: string; qty: number; unitCts: number }[] = [];
    for (const l of clean) {
      const v = await tx.shopVariant.findFirst({ where: { id: l.variantId, item: { clubId, active: true } }, include: { item: true } });
      if (!v) throw new StockError("An item is no longer available.");
      // Conditional decrement: fails if another order took the stock first
      const res = await tx.shopVariant.updateMany({ where: { id: v.id, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } });
      if (res.count === 0) throw new StockError("Only {n} left of {item}.", { n: v.stock, item: `${v.item.name} (${v.label})` });
      total += v.item.priceCts * l.qty;
      data.push({ variantId: v.id, name: `${v.item.name} (${v.label})`, qty: l.qty, unitCts: v.item.priceCts });
    }
    return tx.order.create({ data: { clubId, parentId, totalCts: total, paymentMethod, note: note ?? null, lines: { create: data } }, include: { lines: true } });
  });
}

/** Cancel an order and return its stock. Safe to call twice. */
export async function cancelOrder(orderId: string) {
  await db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!o || o.status === "cancelled" || o.status === "collected") return;
    for (const l of o.lines) await tx.shopVariant.update({ where: { id: l.variantId }, data: { stock: { increment: l.qty } } });
    await tx.order.update({ where: { id: o.id }, data: { status: "cancelled" } });
  });
}

export async function startCheckout(orderId: string, appUrl: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true, club: true, parent: true } });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: o.parent.email,
    line_items: o.lines.map((l) => ({ quantity: l.qty, price_data: { currency: o.club.currency, unit_amount: l.unitCts, product_data: { name: l.name } } })),
    metadata: { orderId: o.id, clubId: o.clubId },
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1h hold on stock
    success_url: `${appUrl}/portal/orders?paid=${o.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/portal/orders?cancelled=${o.id}`,
  });
  await db.order.update({ where: { id: o.id }, data: { stripeSessionId: session.id } });
  return session.url!;
}

/** Mark paid if Stripe says so (used by the webhook and the success redirect). */
export async function syncCheckout(sessionId: string) {
  const stripe = getStripe();
  if (!stripe) return null;
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  // Club fee payments (payment links) carry feeId instead of orderId.
  if (s.metadata?.feeId) {
    if (s.payment_status === "paid") {
      await db.feeInvoice.updateMany({ where: { id: s.metadata.feeId, paidAt: null }, data: { paidAt: new Date(), method: "stripe" } });
    }
    return s.metadata.feeId;
  }
  const orderId = s.metadata?.orderId;
  if (!orderId) return null;
  if (s.payment_status === "paid") {
    await db.order.updateMany({ where: { id: orderId, paymentStatus: "unpaid" }, data: { paymentStatus: "paid", paidAt: new Date() } });
  } else if (s.status === "expired") {
    const o = await db.order.findUnique({ where: { id: orderId } });
    if (o && o.paymentStatus === "unpaid" && o.paymentMethod === "stripe") await cancelOrder(orderId);
  }
  return orderId;
}
