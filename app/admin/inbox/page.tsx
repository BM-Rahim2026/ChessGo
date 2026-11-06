import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Pill, Empty, Tabs } from "@/components/ui";
import { fmtDate, str, optStr } from "@/lib/format";
import { convertSubmission } from "@/lib/conversion";
import { appUrl } from "@/lib/appUrl";

async function convert(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const studentId = await convertSubmission(clubId, str(fd.get("id")), optStr(fd.get("groupId")));
  redirect(`/admin/students/${studentId}`);
}
async function setStatus(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const status = str(fd.get("status"));
  if (!["new", "contacted", "archived"].includes(status)) return;
  await db.formSubmission.updateMany({ where: { id: str(fd.get("id")), clubId, NOT: { status: "converted" } }, data: { status } });
  revalidatePath("/admin/inbox");
}

export default async function Inbox({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { clubId, club } = await requireStaff(true);
  const tab = (await searchParams).tab ?? "open";
  const where = tab === "open" ? { status: { in: ["new", "contacted"] } } : tab === "all" ? {} : { status: tab };
  const [subs, groups, counts] = await Promise.all([
    db.formSubmission.findMany({ where: { clubId, ...where }, orderBy: { createdAt: "desc" } }),
    db.group.findMany({ where: { clubId }, orderBy: { name: "asc" }, include: { _count: { select: { students: { where: { status: "active" } } } } } }),
    db.formSubmission.groupBy({ by: ["status"], where: { clubId }, _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((r) => [r.status, r._count]));
  const gname = new Map(groups.map((g) => [g.id, g.name]));
  const base = appUrl();
  return (
    <div>
      <PageHeader title="Inbox" sub="Trial lesson requests and registrations from your public page and embedded forms." />
      <Tabs active={tab} items={[
        { key: "open", label: `Open (${(c.new ?? 0) + (c.contacted ?? 0)})`, href: "/admin/inbox?tab=open" },
        { key: "converted", label: `Converted (${c.converted ?? 0})`, href: "/admin/inbox?tab=converted" },
        { key: "archived", label: `Archived (${c.archived ?? 0})`, href: "/admin/inbox?tab=archived" },
        { key: "all", label: "All", href: "/admin/inbox?tab=all" },
      ]} />
      {subs.length === 0 && <Empty>Nothing here.</Empty>}
      <div className="space-y-3">
        {subs.map((s) => (
          <div key={s.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.childFirst} {s.childLast}</span>
                  <Pill v={s.kind === "trial" ? "trial" : "new"}>{s.kind === "trial" ? "Trial lesson" : "Registration"}</Pill>
                  <Pill v={s.status} />
                </div>
                <div className="muted mt-1">
                  {s.childBirth ? `Born ${fmtDate(s.childBirth)} · ` : ""}Parent {s.parentFirst} {s.parentLast} · <a className="underline" href={`mailto:${s.parentEmail}`}>{s.parentEmail}</a>{s.parentPhone ? ` · ${s.parentPhone}` : ""}
                </div>
                <div className="muted">
                  {s.groupId ? `Wants: ${gname.get(s.groupId) ?? "—"} · ` : ""}{s.preferredDate ? `Preferred: ${s.preferredDate} · ` : ""}Received {fmtDate(s.createdAt)}
                </div>
                {s.message && <p className="mt-2 whitespace-pre-wrap text-sm">{s.message}</p>}
              </div>
              {s.status === "converted" ? (
                <Link className="btn-secondary" href={`/admin/students/${s.convertedStudentId}`}>Open student →</Link>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  <form action={convert} className="flex gap-1">
                    <input type="hidden" name="id" value={s.id} />
                    <select className="input py-1" name="groupId" defaultValue={s.groupId ?? ""}>
                      <option value="">No group yet</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g._count.students}/{g.capacity})</option>)}
                    </select>
                    <button className="btn whitespace-nowrap">Convert to student</button>
                  </form>
                  <div className="flex gap-1">
                    {s.status !== "contacted" && <form action={setStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="contacted" /><button className="btn-secondary btn-sm">Mark contacted</button></form>}
                    {s.status !== "archived" && <form action={setStatus}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="archived" /><button className="btn-secondary btn-sm">Archive</button></form>}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="card mt-8">
        <h2 className="h2 mb-2">Embed the forms on your own website</h2>
        <p className="muted mb-2">Paste one of these snippets into any web page.</p>
        {(["trial", "register"] as const).map((k) => (
          <pre key={k} className="mb-2 overflow-x-auto rounded-control bg-forest p-3 text-xs text-cream">{`<iframe src="${base}/embed/${club.slug}/${k}" style="width:100%;max-width:560px;height:760px;border:0" title="${k === "trial" ? "Book a trial lesson" : "Registration"}"></iframe>`}</pre>
        ))}
      </div>
    </div>
  );
}
