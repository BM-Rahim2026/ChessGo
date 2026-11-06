import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { money, str, optStr, toCents } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";

const CATEGORIES = { tshirt: "T-shirt", chess_set: "Chess set", book: "Book", other: "Other" } as const;

async function saveItem(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const id = str(fd.get("id"));
  const img = optStr(fd.get("imageUrl"));
  const cat = str(fd.get("category"));
  const data = {
    name: str(fd.get("name")), description: optStr(fd.get("description")), priceCts: toCents(fd.get("price")),
    category: cat in CATEGORIES ? cat : "other", imageUrl: img && /^https?:\/\//.test(img) ? img : null, active: fd.get("active") === "on",
  };
  if (id) await db.shopItem.updateMany({ where: { id, clubId }, data });
  else {
    const sizes = str(fd.get("sizes")).split(",").map((s) => s.trim()).filter(Boolean);
    const stock = Math.max(0, Number(fd.get("stock")) || 0);
    await db.shopItem.create({ data: { ...data, clubId, variants: { create: (sizes.length ? sizes : ["Standard"]).map((label) => ({ label, stock })) } } });
  }
  revalidatePath("/admin/shop");
}
async function saveVariant(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const id = str(fd.get("variantId"));
  const stock = Math.max(0, Number(fd.get("stock")) || 0);
  if (id) await db.shopVariant.updateMany({ where: { id, item: { clubId } }, data: { stock, label: str(fd.get("label")) } });
  else {
    const item = await db.shopItem.findFirst({ where: { id: str(fd.get("itemId")), clubId } });
    if (item) await db.shopVariant.create({ data: { itemId: item.id, label: str(fd.get("label")) || "Standard", stock } });
  }
  revalidatePath("/admin/shop");
}
async function deleteVariant(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const v = await db.shopVariant.findFirst({ where: { id: str(fd.get("variantId")), item: { clubId } }, include: { _count: { select: { orderLines: true } } } });
  if (v && v._count.orderLines === 0) await db.shopVariant.delete({ where: { id: v.id } });
  else if (v) await db.shopVariant.update({ where: { id: v.id }, data: { stock: 0 } });
  revalidatePath("/admin/shop");
}

export default async function ShopAdmin() {
  const { clubId, club } = await requireStaff(true);
  const items = await db.shopItem.findMany({ where: { clubId }, include: { variants: { orderBy: { label: "asc" } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Shop" sub={`Parents order from their portal. Payment: ${stripeEnabled() ? "Stripe card checkout or pay at club" : "pay at club (add STRIPE_SECRET_KEY to enable cards)"}.`} />
      {items.length === 0 && <Empty>No items yet.</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((it) => (
          <div key={it.id} className={`card ${it.active ? "" : "opacity-60"}`}>
            <form action={saveItem} className="grid-form">
              <input type="hidden" name="id" value={it.id} />
              <Field label="Name"><input className="input" name="name" defaultValue={it.name} /></Field>
              <Field label={`Price (${club.currency.toUpperCase()})`}><input className="input" name="price" type="number" step="0.01" defaultValue={it.priceCts / 100} /></Field>
              <Field label="Category"><select className="input" name="category" defaultValue={it.category}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Image URL"><input className="input" name="imageUrl" defaultValue={it.imageUrl ?? ""} /></Field>
              <Field label="Description" className="sm:col-span-2"><input className="input" name="description" defaultValue={it.description ?? ""} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={it.active} /> Listed in shop</label>
              <div className="flex justify-end"><button className="btn-secondary btn-sm">Save item</button></div>
            </form>
            <h3 className="label mt-4">Sizes / variants & stock</h3>
            <div className="space-y-1">
              {it.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-1">
                  <form action={saveVariant} className="flex flex-1 items-center gap-1">
                    <input type="hidden" name="variantId" value={v.id} />
                    <input className="input w-28 py-1" name="label" defaultValue={v.label} />
                    <input className="input w-20 py-1" name="stock" type="number" min={0} defaultValue={v.stock} />
                    <span className={`text-xs ${v.stock === 0 ? "text-red-600" : v.stock < 3 ? "text-amber-600" : "text-stone-500"}`}>{v.stock === 0 ? "sold out" : v.stock < 3 ? "low" : "in stock"}</span>
                    <button className="btn-secondary btn-sm ml-auto">Save</button>
                  </form>
                  <form action={deleteVariant}><input type="hidden" name="variantId" value={v.id} /><button className="text-xs text-red-600" title="Remove">×</button></form>
                </div>
              ))}
              <form action={saveVariant} className="flex items-center gap-1 pt-1">
                <input type="hidden" name="itemId" value={it.id} />
                <input className="input w-28 py-1" name="label" placeholder="New size" />
                <input className="input w-20 py-1" name="stock" type="number" min={0} placeholder="0" />
                <button className="btn-secondary btn-sm">Add</button>
              </form>
            </div>
            <p className="muted mt-2">{money(it.priceCts, club.currency)} · {it.variants.reduce((a, v) => a + v.stock, 0)} in stock</p>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">New item</h2>
        <form action={saveItem} className="grid-form">
          <Field label="Name"><input className="input" name="name" required placeholder="Club T-shirt" /></Field>
          <Field label={`Price (${club.currency.toUpperCase()})`}><input className="input" name="price" type="number" step="0.01" required /></Field>
          <Field label="Category"><select className="input" name="category">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Image URL"><input className="input" name="imageUrl" /></Field>
          <Field label="Sizes, comma separated (blank = one variant)"><input className="input" name="sizes" placeholder="XS, S, M, L, XL" /></Field>
          <Field label="Starting stock per size"><input className="input" name="stock" type="number" min={0} defaultValue={10} /></Field>
          <Field label="Description" className="sm:col-span-2"><input className="input" name="description" /></Field>
          <input type="hidden" name="active" value="on" />
          <div className="sm:col-span-2 flex justify-end"><button className="btn">Add item</button></div>
        </form>
      </div>
    </div>
  );
}
