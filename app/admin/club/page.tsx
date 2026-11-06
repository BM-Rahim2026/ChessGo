import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { fmtDate, str, optStr } from "@/lib/format";

async function saveClub(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const logo = optStr(fd.get("logoUrl"));
  await db.club.update({
    where: { id: clubId },
    data: {
      name: str(fd.get("name")), description: optStr(fd.get("description")), address: optStr(fd.get("address")),
      email: optStr(fd.get("email")), phone: optStr(fd.get("phone")),
      logoUrl: logo && /^https?:\/\//.test(logo) ? logo : null,
    },
  });
  revalidatePath("/admin/club");
}
async function addNews(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  await db.newsPost.create({ data: { clubId, title: str(fd.get("title")), body: str(fd.get("body")), published: fd.get("published") === "on" } });
  revalidatePath("/admin/club");
}
async function toggleNews(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const p = await db.newsPost.findFirst({ where: { id: str(fd.get("id")), clubId } });
  if (p) await db.newsPost.update({ where: { id: p.id }, data: { published: !p.published } });
  revalidatePath("/admin/club");
}
async function deleteNews(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  await db.newsPost.deleteMany({ where: { id: str(fd.get("id")), clubId } });
  revalidatePath("/admin/club");
}

export default async function ClubSettings() {
  const { club } = await requireStaff(true);
  const news = await db.newsPost.findMany({ where: { clubId: club.id }, orderBy: { publishedAt: "desc" } });
  return (
    <div>
      <PageHeader title="Club page & news" sub="Groups, schedule and coaches are pulled in automatically.">
        <Link className="btn-secondary" href={`/c/${club.slug}`} target="_blank">View public page ↗</Link>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={saveClub} className="card space-y-3">
          <h2 className="h2">Club profile</h2>
          <Field label="Club name"><input className="input" name="name" defaultValue={club.name} required /></Field>
          <Field label="Logo URL (https://…)"><input className="input" name="logoUrl" defaultValue={club.logoUrl ?? ""} /></Field>
          <Field label="About"><textarea className="input" name="description" rows={4} defaultValue={club.description ?? ""} /></Field>
          <Field label="Address"><input className="input" name="address" defaultValue={club.address ?? ""} /></Field>
          <div className="grid-form">
            <Field label="Email"><input className="input" name="email" type="email" defaultValue={club.email ?? ""} /></Field>
            <Field label="Phone"><input className="input" name="phone" defaultValue={club.phone ?? ""} /></Field>
          </div>
          <p className="muted">Public address: <code>/c/{club.slug}</code></p>
          <div className="flex justify-end"><button className="btn">Save</button></div>
        </form>
        <div className="card">
          <h2 className="h2 mb-3">News</h2>
          <form action={addNews} className="space-y-2">
            <input className="input" name="title" placeholder="Title" required />
            <textarea className="input" name="body" rows={3} placeholder="What's happening at the club?" required />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="published" defaultChecked /> Publish now</label>
              <button className="btn">Post</button>
            </div>
          </form>
          <ul className="mt-4 divide-y divide-stone-100">
            {news.map((n) => (
              <li key={n.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.title} {!n.published && <span className="pill">draft</span>}</span>
                  <span className="flex gap-1">
                    <form action={toggleNews}><input type="hidden" name="id" value={n.id} /><button className="btn-secondary btn-sm">{n.published ? "Unpublish" : "Publish"}</button></form>
                    <form action={deleteNews}><input type="hidden" name="id" value={n.id} /><button className="btn-danger btn-sm">Delete</button></form>
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
