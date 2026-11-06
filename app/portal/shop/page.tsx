import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalContext } from "@/lib/portal";
import { placeOrder, startCheckout, cancelOrder, StockError } from "@/lib/shop";
import { stripeEnabled } from "@/lib/stripe";
import { PageHeader, Empty } from "@/components/ui";
import { money, optStr } from "@/lib/format";

async function order(fd: FormData) {
  "use server";
  const { parent, club } = await portalContext();
  if (!parent) redirect("/portal");
  const lines = [...fd.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ variantId: k.slice(4), qty: Math.trunc(Number(v)) || 0 }));
  const method = fd.get("method") === "stripe" && stripeEnabled() ? "stripe" : "at_club";
  let o;
  try {
    o = await placeOrder(club.id, parent.id, lines, method, optStr(fd.get("note")));
  } catch (e) {
    if (e instanceof StockError) redirect(`/portal/shop?error=${encodeURIComponent(e.message)}`);
    throw e;
  }
  if (method === "stripe") {
    let url: string;
    try {
      url = await startCheckout(o.id, process.env.APP_URL ?? "http://localhost:3000");
    } catch {
      await cancelOrder(o.id);
      redirect(`/portal/shop?error=${encodeURIComponent("Card payment is unavailable right now. Please choose pay at club.")}`);
    }
    redirect(url);
  }
  redirect(`/portal/orders?placed=${o.id}`);
}

export default async function Shop({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { club, parent } = await portalContext();
  if (!parent) redirect("/portal");
  const { error } = await searchParams;
  const items = await db.shopItem.findMany({ where: { clubId: club.id, active: true }, include: { variants: { orderBy: { label: "asc" } } }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  const stripe = stripeEnabled();
  return (
    <div>
      <PageHeader title="Club shop" sub="Pick quantities, then choose how to pay." />
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {items.length === 0 ? <Empty>The shop is empty right now.</Empty> : (
        <form action={order}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <div key={it.id} className="card flex flex-col">
                {it.imageUrl ? <img src={it.imageUrl} alt="" className="mb-3 h-40 w-full rounded object-cover" /> : <div className="mb-3 flex h-40 items-center justify-center rounded bg-stone-100 text-5xl">{it.category === "tshirt" ? "👕" : it.category === "book" ? "📘" : "♟"}</div>}
                <div className="flex items-baseline justify-between"><h2 className="font-semibold">{it.name}</h2><span className="font-semibold">{money(it.priceCts, club.currency)}</span></div>
                {it.description && <p className="muted mt-1">{it.description}</p>}
                <div className="mt-3 space-y-1">
                  {it.variants.map((v) => (
                    <label key={v.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{v.label} {v.stock === 0 ? <span className="text-red-600">· sold out</span> : v.stock < 3 ? <span className="text-amber-600">· {v.stock} left</span> : null}</span>
                      <input className="input w-20 py-1" type="number" name={`qty_${v.id}`} min={0} max={Math.min(v.stock, 20)} defaultValue={0} disabled={v.stock === 0} aria-label={`${it.name} ${v.label} quantity`} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="card mt-6 space-y-3">
            <h2 className="h2">Payment</h2>
            {stripe && <label className="flex items-center gap-2 text-sm"><input type="radio" name="method" value="stripe" defaultChecked /> Pay now by card (Stripe)</label>}
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="method" value="at_club" defaultChecked={!stripe} /> Pay at the club when collecting</label>
            <input className="input" name="note" placeholder="Note for the club (optional)" maxLength={300} />
            <button className="btn">Place order</button>
          </div>
        </form>
      )}
    </div>
  );
}
