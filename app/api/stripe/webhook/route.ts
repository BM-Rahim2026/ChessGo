import { NextResponse } from "next/server";
import { getStripe, logStripeError } from "@/lib/stripe";
import { syncCheckout } from "@/lib/shop";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch (e) {
    logStripeError("webhook-signature", e);
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded" || event.type === "checkout.session.expired") {
    try {
      await syncCheckout((event.data.object as { id: string }).id);
    } catch (e) {
      logStripeError(`webhook-${event.type}`, e);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Stripe retries
    }
  }
  return NextResponse.json({ received: true });
}
