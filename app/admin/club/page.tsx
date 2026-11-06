import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { fmtDate, str, optStr } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

async function saveClub(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const logo = optStr(fd.get("logoUrl"));
  await db.club.update({
    where: { id: clubId },
    data: {
      name: str(fd.get("name")), description: optStr(fd.get("description")), address: optStr(fd.get("address")),
      email: optStr(fd.get("email")), phone: optStr(fd.get("phone")),
      currency: ["pln", "eur"].includes(str(fd.get("currency"))) ? str(fd.get("currency")) : "pln",
      logoUrl: logo && /^https?:\/\//.test(logo) ? logo : null,
    },
  });
  revalidatePath("/admin/club");
  revalidatePath("/c/[slug]", "page");
  redirect(`/admin/club?saved=${Date.now()}`);
}
async function addNews(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  await db.newsPost.create({ data: { clubId, title: str(fd.get("title")), body: str(fd.get("body")), published: fd.get("published") === "on" } });
  revalidatePath("/admin/club");
}
async function toggleNews(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const p = await db.newsPost.findFirst({ where: { id: str(fd.get("id")), clubId } });
  if (p) await db.newsPost.update({ where: { id: p.id }, data: { published: !p.published } });
  revalidatePath("/admin/club");
}
async function deleteNews(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  await db.newsPost.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/club");
}

export default async function ClubSettings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const t = await getT();
  const { club } = await requireStaff(true);
  const { saved } = await searchParams;
  const news = await db.newsPost.findMany({ where: { clubId: club.id }, orderBy: { publishedAt: "desc" } });
  return (
    <div>
      <PageHeader title={t("Club page & news")} sub={t("Groups, schedule and coaches are pulled in automatically.")}>
        <Link className="btn-secondary" href={`/c/${club.slug}`} target="_blank">{t("View public page ↗")}</Link>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <form key={`${club.name}|${club.currency}|${club.address}|${club.email}|${club.phone}|${club.logoUrl}|${club.description}`} action={saveClub} className="card space-y-3">
          <h2 className="h2">{t("Club profile")}</h2>
          {saved && <p role="status" className="rounded-control bg-mint p-3 text-sm font-semibold text-forest">{t("✓ Saved. Your public page is updated.")}</p>}
          <Field label={t("Club name")}><input className="input" name="name" defaultValue={club.name} required /></Field>
          <Field label={t("Logo URL (https://…)")}><input className="input" name="logoUrl" defaultValue={club.logoUrl ?? ""} /></Field>
          <Field label={t("About")}><textarea className="input" name="description" rows={4} defaultValue={club.description ?? ""} /></Field>
          <Field label={t("Address")}><input className="input" name="address" defaultValue={club.address ?? ""} /></Field>
          <div className="grid-form">
            <Field label={t("Email")}><input className="input" name="email" type="email" defaultValue={club.email ?? ""} /></Field>
            <Field label={t("Phone")}><input className="input" name="phone" defaultValue={club.phone ?? ""} /></Field>
          </div>
          <Field label={t("Currency for fees and shop")}>
            <select className="input" name="currency" defaultValue={club.currency}>
              <option value="pln">PLN (zł)</option>
              <option value="eur">EUR (€)</option>
            </select>
          </Field>
          <p className="muted">{t("Public address")}: <code>/c/{club.slug}</code></p>
          <div className="flex justify-end"><button className="btn">{t("Save")}</button></div>
        </form>
        <div className="card">
          <h2 className="h2 mb-3">{t("News")}</h2>
          <form action={addNews} className="space-y-2">
            <input className="input" name="title" placeholder={t("Title")} required />
            <textarea className="input" name="body" rows={3} placeholder={t("What's happening at the club?")} required />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked /> {t("Publish now")}</label>
              <button className="btn">{t("Post")}</button>
            </div>
          </form>
          <ul className="mt-4 divide-y divide-ink/10">
            {news.map((n) => (
              <li key={n.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.title} {!n.published && <span className="pill">{t("draft")}</span>}</span>
                  <span className="flex gap-1">
                    <form action={toggleNews}><input type="hidden" name="id" value={n.id} /><button className="btn-secondary btn-sm">{n.published ? t("Unpublish") : t("Publish")}</button></form>
                    <form action={deleteNews}><input type="hidden" name="id" value={n.id} /><button className="btn-danger btn-sm">{t("Delete")}</button></form>
                  </span>
                </div>
                <div className="muted">{fmtDate(n.publishedAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
