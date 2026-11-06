import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Pill, Empty, Tabs } from "@/components/ui";
import { money, fmtDate, str } from "@/lib/format";
import { cancelOrder } from "@/lib/shop";
import { getT } from "@/lib/i18n/server";

async function update(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const o = await db.order.findFirst({ where: { id: str(fd.get("id")), clubId } });
  if (!o) return;
  const action = str(fd.get("action"));
  if (action === "cancel") await cancelOrder(o.id);
  else if (action === "ready" || action === "collected") await db.order.update({ where: { id: o.id }, data: { status: action } });
  else if (action === "paid") await db.order.update({ where: { id: o.id }, data: { paymentStatus: "paid", paidAt: new Date() } });
  else if (action === "refunded") await db.order.update({ where: { id: o.id }, data: { paymentStatus: "refunded" } });
  revalidatePath("/admin/orders");
}

export default async function Orders({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await getT();
  const { clubId, club } = await requireStaff(true);
  const tab = (await searchParams).tab ?? "open";
  const where = tab === "open" ? { status: { in: ["pending", "ready"] } } : tab === "unpaid" ? { paymentStatus: "unpaid", status: { not: "cancelled" } } : {};
  const orders = await db.order.findMany({ where: { clubId, ...where }, include: { lines: true, parent: true }, orderBy: { createdAt: "desc" }, take: 200 });
  const Btn = ({ id, action, label, primary }: { id: string; action: string; label: string; primary?: boolean }) => (
    <form action={update}><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} /><button className={`${primary ? "btn" : action === "cancel" ? "btn-danger" : "btn-secondary"} btn-sm`}>{label}</button></form>
  );
  return (
    <div>
      <PageHeader title={t("Shop orders")} />
      <Tabs active={tab} items={[{ key: "open", label: t("To fulfil"), href: "/admin/orders?tab=open" }, { key: "unpaid", label: t("Unpaid"), href: "/admin/orders?tab=unpaid" }, { key: "all", label: t("All"), href: "/admin/orders?tab=all" }]} />
      {orders.length === 0 && <Empty>{t("No orders.")}</Empty>}
      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{o.parent.firstName} {o.parent.lastName} <span className="muted font-normal">· {o.parent.email}{o.parent.phone ? ` · ${o.parent.phone}` : ""}</span></div>
                <div className="muted">#{o.id.slice(-6).toUpperCase()} · {fmtDate(o.createdAt)} · {o.paymentMethod === "stripe" ? t("Card (Stripe)") : t("Pay at club")}</div>
                <ul className="mt-2 text-sm">{o.lines.map((l) => <li key={l.id}>{l.qty} × {l.name} — {money(l.unitCts * l.qty, club.currency)}</li>)}</ul>
                {o.note && <p className="muted mt-1">{t("Note")}: {o.note}</p>}
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{money(o.totalCts, club.currency)}</div>
                <div className="mt-1 flex justify-end gap-1"><Pill v={o.paymentStatus} /><Pill v={o.status} /></div>
              </div>
            </div>
            {o.status !== "cancelled" && (
              <div className="mt-3 flex flex-wrap gap-1 border-t border-ink/10 pt-3">
                {o.paymentStatus === "unpaid" && <Btn id={o.id} action="paid" label={t("Mark paid")} primary />}
                {o.status === "pending" && <Btn id={o.id} action="ready" label={t("Ready for pickup")} />}
                {o.status !== "collected" && <Btn id={o.id} action="collected" label={t("Collected")} />}
                {o.paymentStatus === "paid" && <Btn id={o.id} action="refunded" label={t("Mark refunded")} />}
                {o.status !== "collected" && <Btn id={o.id} action="cancel" label={t("Cancel & restock")} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
