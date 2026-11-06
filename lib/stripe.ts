import "server-only";
import Stripe from "stripe";

let client: Stripe | null | undefined;
export function getStripe(): Stripe | null {
  if (client === undefined) {
    const key = process.env.STRIPE_SECRET_KEY?.trim(); // tolerate pasted spaces/newlines
    client = key ? new Stripe(key) : null;
  }
  return client;
}
export const stripeEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY?.trim());

/** Log a Stripe failure with enough detail to diagnose it (never logs keys). */
export function logStripeError(where: string, e: unknown) {
  const err = e as { type?: string; code?: string; message?: string; param?: string; statusCode?: number; raw?: { request_log_url?: string } };
  console.error(`[stripe:${where}]`, JSON.stringify({ type: err?.type, code: err?.code, status: err?.statusCode, param: err?.param, message: err?.message, log: err?.raw?.request_log_url }));
}

export type StripeStatus =
  | { ok: true; mode: "test" | "live"; country?: string | null; chargesEnabled: boolean; currency?: string | null; name?: string | null }
  | { ok: false; reason: string };

/** Quick health check for the admin screen: is the key valid, which mode, can it take payments? */
export async function stripeStatus(): Promise<StripeStatus | null> {
  const s = getStripe();
  if (!s) return null;
  const key = process.env.STRIPE_SECRET_KEY!.trim();
  if (!/^(sk|rk)_(test|live)_/.test(key)) return { ok: false, reason: "STRIPE_SECRET_KEY does not look like a secret key (it should start with sk_test_ or sk_live_). A publishable key (pk_…) does not work here." };
  try {
    const acct = await s.accounts.retrieve();
    return { ok: true, mode: key.includes("_test_") ? "test" : "live", country: acct.country, chargesEnabled: Boolean(acct.charges_enabled), currency: acct.default_currency, name: acct.settings?.dashboard?.display_name ?? acct.business_profile?.name ?? null };
  } catch (e) {
    logStripeError("status", e);
    return { ok: false, reason: (e as Error)?.message ?? "Unknown Stripe error" };
  }
}
