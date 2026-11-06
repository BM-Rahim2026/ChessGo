import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { money, str, optStr, toCents } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";
import { getT } from "@/lib/i18n/server";

const CATEGORIES = { tshirt: "T-shirt", chess_set: "Chess set", book: "Book", other: "Other" } as const;

async function saveItem(fd: FormData) {
  "use server";
  const t = await getT();
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
  const t = await getT();
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
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const v = await db.shopVariant.findFirst({ where: { id: str(fd.get("variantId")), item: { clubId } }, include: { _count: { select: { orderLines: true } } } });
  if (v && v._count.orderLines === 0) await db.shopVariant.delete({ where: { id: v.id } });
  else if (v) await db.shopVariant.update({ where: { id: v.id }, data: { stock: 0 } });
  revalidatePath("/admin/shop");
}

export default async function ShopAdmin() {
  const t = await getT();
  const { clubId, club } = await requireStaff(true);
  const items = await db.shopItem.findMany({ where: { clubId }, include: { variants: { orderBy: { label: "asc" } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title={t("Shop")} sub={`${t("Parents order from their portal.")} ${t("Payment")}: ${stripeEnabled() ? t("Stripe card checkout or pay at club") : t("pay at club (add STRIPE_SECRET_KEY to enable cards)")}.`} />
      {items.length === 0 && <Empty>{t("No items yet.")}</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {items.map((it) => (
          <div key={it.id} className={`card ${it.active ? "" : "opacity-60"}`}>
            <form key={`${it.id}|${it.name}|${it.priceCts}|${it.category}|${it.imageUrl}|${it.description}|${it.active}`} action={saveItem} className="grid-form">
              <input type="hidden" name="id" value={it.id} />
              <Field label={t("Name")}><input className="input" name="name" defaultValue={it.name} /></Field>
              <Field label={`${t("Price")} (${club.currency.toUpperCase()})`}><input className="input" name="price" type="number" step="0.01" defaultValue={it.priceCts / 100} /></Field>
              <Field label={t("Category")}><select className="input" name="category" defaultValue={it.category}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
              <Field label={t("Image URL")}><input className="input" name="imageUrl" defaultValue={it.imageUrl ?? ""} /></Field>
              <Field label={t("Description")} className="sm:col-span-2"><input className="input" name="description" defaultValue={it.description ?? ""} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={it.active} /> {t("Listed in shop")}</label>
              <div className="flex justify-end"><button className="btn-secondary btn-sm">{t("Save item")}</button></div>
            </form>
            <h3 className="label mt-4">{t("Sizes / variants & stock")}</h3>
            <div className="space-y-1">
              {it.variants.map((v) => (
                <div key={v.id} className="flex items-center gap-1">
                  <form action={saveVariant} className="flex flex-1 items-center gap-1">
                    <input type="hidden" name="variantId" value={v.id} />
                    <input className="input w-28 py-1" name="label" defaultValue={v.label} />
                    <input className="input w-20 py-1" name="stock" type="number" min={0} defaultValue={v.stock} />
                    <span className={`text-xs ${v.stock === 0 ? "text-red-600" : v.stock < 3 ? "text-amber-600" : "text-ink-soft"}`}>{v.stock === 0 ? t("sold out") : v.stock < 3 ? t("low") : t("in stock")}</span>
                    <button className="btn-secondary btn-sm ml-auto">{t("Save")}</button>
                  </form>
                  <form action={deleteVariant}><input type="hidden" name="variantId" value={v.id} /><button className="text-xs text-red-600" title={t("Remove")}>×</button></form>
                </div>
              ))}
              <form action={saveVariant} className="flex items-center gap-1 pt-1">
                <input type="hidden" name="itemId" value={it.id} />
                <input className="input w-28 py-1" name="label" placeholder={t("New size")} />
                <input className="input w-20 py-1" name="stock" type="number" min={0} placeholder="0" />
                <button className="btn-secondary btn-sm">{t("Add")}</button>
              </form>
            </div>
            <p className="muted mt-2">{money(it.priceCts, club.currency)} · {t("{n} in stock", { n: it.variants.reduce((a, v) => a + v.stock, 0) })}</p>
          </div>
        ))}
      </div>
      <div className="card mt-6">
        <h2 className="h2 mb-3">{t("New item")}</h2>
        <form action={saveItem} className="grid-form">
          <Field label={t("Name")}><input className="input" name="name" required placeholder={t("Club T-shirt")} /></Field>
          <Field label={`${t("Price")} (${club.currency.toUpperCase()})`}><input className="input" name="price" type="number" step="0.01" required /></Field>
          <Field label={t("Category")}><select className="input" name="category">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
          <Field label={t("Image URL")}><input className="input" name="imageUrl" /></Field>
          <Field label={t("Sizes, comma separated (blank = one variant)")}><input className="input" name="sizes" placeholder="XS, S, M, L, XL" /></Field>
          <Field label={t("Starting stock per size")}><input className="input" name="stock" type="number" min={0} defaultValue={10} /></Field>
          <Field label={t("Description")} className="sm:col-span-2"><input className="input" name="description" /></Field>
          <input type="hidden" name="active" value="on" />
          <div className="sm:col-span-2 flex justify-end"><button className="btn">{t("Add item")}</button></div>
        </form>
      </div>
    </div>
  );
}
