import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Stat } from "@/components/ui";
import { fmtDate, money, str, optStr, dayKey } from "@/lib/format";
import { setXp, studentMetrics, evaluateBadges } from "@/lib/gamification";
import { displayStreak } from "@/lib/streak";
import { LeagueBadge } from "@/components/Brand";
import { findOrCreateParent, createLogin, resetLogin } from "@/lib/people";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";

async function load(id: string, clubId: string) {
  const s = await db.student.findFirst({ where: { id, clubId } });
  if (!s) throw new Error("Not found");
  return s;
}

async function updateStudent(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const s = await load(str(fd.get("id")), clubId);
  const status = str(fd.get("status")) === "inactive" ? "inactive" : "active";
  const groupId = optStr(fd.get("groupId"));
  const birth = optStr(fd.get("birthDate"));
  await db.student.update({
    where: { id: s.id },
    data: {
      firstName: str(fd.get("firstName")), lastName: str(fd.get("lastName")), birthDate: birth ? new Date(birth) : null,
      notes: optStr(fd.get("notes")), status,
      groupId: groupId && (await db.group.findFirst({ where: { id: groupId, clubId } })) ? groupId : null,
      leftAt: status === "inactive" ? (s.leftAt ?? new Date()) : null,
    },
  });
  revalidatePath(`/admin/students/${s.id}`);
}

async function bonusXp(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId, user } = await requireStaff();
  const s = await load(str(fd.get("id")), clubId);
  const amount = Math.trunc(Number(fd.get("amount")));
  if (!amount || Math.abs(amount) > 500) return;
  await setXp({ clubId, studentId: s.id, sourceKey: null, amount, reason: "bonus", note: optStr(fd.get("note")), awardedById: user.id });
  revalidatePath(`/admin/students/${s.id}`);
}

async function awardBadge(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff();
  const s = await load(str(fd.get("id")), clubId);
  const badge = await db.badge.findFirst({ where: { id: str(fd.get("badgeId")), clubId } });
  if (badge) await db.studentBadge.upsert({ where: { studentId_badgeId: { studentId: s.id, badgeId: badge.id } }, update: {}, create: { studentId: s.id, badgeId: badge.id } });
  revalidatePath(`/admin/students/${s.id}`);
}

async function addParent(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const s = await load(str(fd.get("id")), clubId);
  const p = await findOrCreateParent(clubId, { firstName: str(fd.get("firstName")), lastName: str(fd.get("lastName")), email: str(fd.get("email")), phone: optStr(fd.get("phone")) });
  await db.studentParent.upsert({ where: { studentId_parentId: { studentId: s.id, parentId: p.id } }, update: {}, create: { studentId: s.id, parentId: p.id } });
  revalidatePath(`/admin/students/${s.id}`);
}

async function makeLogin(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const s = await load(str(fd.get("id")), clubId);
  const kind = str(fd.get("kind"));
  let r;
  if (kind === "student") {
    r = await createLogin({ clubId, email: str(fd.get("email")), name: `${s.firstName} ${s.lastName}`, role: "student" });
    if (r) await db.student.update({ where: { id: s.id }, data: { userId: r.user.id } });
  } else {
    const parent = await db.parent.findFirst({ where: { id: str(fd.get("parentId")), clubId } });
    if (!parent) return { ok: false, message: t("Parent not found.") };
    r = await createLogin({ clubId, email: parent.email, name: `${parent.firstName} ${parent.lastName}`, role: "parent" });
    if (r) await db.parent.update({ where: { id: parent.id }, data: { userId: r.user.id } });
  }
  if (!r) return { ok: false, message: t("That email already has a login.") };
  revalidatePath(`/admin/students/${s.id}`);
  return { ok: true, message: t("Login {email} created. Temporary password: {pw} (shown once; share it with the family).", { email: r.user.email, pw: r.password }) };
}

async function resetPw(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const s = await load(str(fd.get("id")), clubId);
  const userId = str(fd.get("userId"));
  const linked = s.userId === userId || (await db.parent.findFirst({ where: { userId, children: { some: { studentId: s.id } } } }));
  if (!linked) return { ok: false, message: t("Login not linked to this student.") };
  const r = await resetLogin(clubId, userId);
  return r ? { ok: true, message: t("New temporary password for {email}: {pw} (shown once).", { email: r.user.email, pw: r.password }) } : { ok: false, message: t("Login not found.") };
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { clubId, club, user } = await requireStaff();
  const { id } = await params;
  const s = await db.student.findFirst({
    where: { id, clubId },
    include: {
      group: true, user: true, parents: { include: { parent: { include: { user: true } } } },
      badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } },
      xpEvents: { orderBy: { createdAt: "desc" }, take: 25, include: { awardedBy: true } },
      feeInvoices: { orderBy: { period: "desc" }, take: 6 },
    },
  });
  if (!s) notFound();
  await evaluateBadges(s.id);
  const [groups, badges, m] = await Promise.all([
    db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    db.badge.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    studentMetrics(s.id),
  ]);
  const isAdmin = user.role === "club_admin";
  const owned = new Set(s.badges.map((b) => b.badgeId));

  return (
    <div>
      <PageHeader title={`${s.firstName} ${s.lastName}`} sub={`${s.group?.name ?? t("No group")} · ${t("joined")} ${fmtDate(s.joinedAt)}`}>
        <LeagueBadge level={Math.floor(s.xp / 100) + 1} />
        <Pill v={s.status} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("XP")} value={s.xp} />
        <Stat label={t("Move Trail")} value={`${displayStreak(s.lastPuzzleDay, dayKey(), s.streak)} ${t("days")}`} hint={t("best {n} in a row", { n: s.bestStreak })} />
        <Stat label={t("Sessions")} value={m.sessions} />
        <Stat label={t("Puzzles")} value={m.puzzles} />
        <Stat label={t("Tournaments")} value={m.tournaments} />
        <Stat label={t("Wins")} value={m.tournament_wins} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">{t("Badges")}</h2>
          <div className="flex flex-wrap gap-2">
            {s.badges.length === 0 && <span className="muted">{t("None yet.")}</span>}
            {s.badges.map((b) => <span key={b.badgeId} className="pill gap-1" title={t(b.badge.description)}>{b.badge.icon} {t(b.badge.name)}</span>)}
          </div>
          <form action={awardBadge} className="mt-4 flex gap-2">
            <input type="hidden" name="id" value={s.id} />
            <select className="input" name="badgeId">{badges.filter((b) => !owned.has(b.id)).map((b) => <option key={b.id} value={b.id}>{b.icon} {t(b.name)}</option>)}</select>
            <button className="btn-secondary whitespace-nowrap">{t("Award badge")}</button>
          </form>
        </div>

        <div className="card">
          <h2 className="h2 mb-3">{t("Bonus XP")}</h2>
          <form action={bonusXp} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={s.id} />
            <Field label={t("Amount")}><input className="input w-24" type="number" name="amount" defaultValue={20} min={-500} max={500} required /></Field>
            <Field label={t("Reason")} className="flex-1"><input className="input" name="note" placeholder={t("Great sportsmanship")} /></Field>
            <button className="btn">{t("Award")}</button>
          </form>
          <h3 className="label mt-5">{t("Recent XP")}</h3>
          <ul className="divide-y divide-ink/10 text-sm">
            {s.xpEvents.map((e) => (
              <li key={e.id} className="flex justify-between py-1.5">
                <span>{t(`xp:${e.reason}`)}{e.note ? ` — ${e.note}` : ""}{e.awardedBy ? <span className="muted"> · {t("by")} {e.awardedBy.name}</span> : null}</span>
                <span className={`tabular-nums ${e.amount < 0 ? "text-red-600" : "text-forest"}`}>{e.amount > 0 ? "+" : ""}{e.amount}</span>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && (
          <div className="card">
            <h2 className="h2 mb-3">{t("Details")}</h2>
            <form key={`${s.firstName}|${s.lastName}|${s.groupId}|${s.status}|${s.birthDate?.toISOString()}|${s.notes}`} action={updateStudent} className="grid-form">
              <input type="hidden" name="id" value={s.id} />
              <Field label={t("First name")}><input className="input" name="firstName" defaultValue={s.firstName} required /></Field>
              <Field label={t("Last name")}><input className="input" name="lastName" defaultValue={s.lastName} required /></Field>
              <Field label={t("Birth date")}><input className="input" type="date" name="birthDate" defaultValue={s.birthDate?.toISOString().slice(0, 10)} /></Field>
              <Field label={t("Group")}><select className="input" name="groupId" defaultValue={s.groupId ?? ""}><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
              <Field label={t("Status")}><select className="input" name="status" defaultValue={s.status}><option value="active">{t("Active")}</option><option value="inactive">{t("Inactive")}</option></select></Field>
              <Field label={t("Notes")} className="sm:col-span-2"><textarea className="input" name="notes" rows={2} defaultValue={s.notes ?? ""} /></Field>
              <div className="sm:col-span-2 flex justify-end"><button className="btn">{t("Save")}</button></div>
            </form>
          </div>
        )}

        <div className="card">
          <h2 className="h2 mb-3">{t("Family & logins")}</h2>
          <ul className="space-y-2 text-sm">
            {s.parents.map(({ parent: p }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.firstName} {p.lastName} · {p.email}{p.phone ? ` · ${p.phone}` : ""}</span>
                {p.user ? (
                  <span className="flex items-center gap-2"><span className="pill pill-green">{t("has login")}</span>{isAdmin && <ActionForm action={resetPw}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="userId" value={p.user.id} /><button className="text-xs text-ink-soft underline">{t("Reset password")}</button></ActionForm>}</span>
                ) : isAdmin && (
                  <ActionForm action={makeLogin}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="parent" /><input type="hidden" name="parentId" value={p.id} /><button className="btn-secondary btn-sm">{t("Create parent login")}</button></ActionForm>
                )}
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2">
              <span>{t("Student login")}: {s.user ? s.user.email : t("none")}</span>
              {s.user && isAdmin && <ActionForm action={resetPw}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="userId" value={s.user.id} /><button className="text-xs text-ink-soft underline">{t("Reset password")}</button></ActionForm>}
              {!s.user && isAdmin && (
                <ActionForm action={makeLogin} className="flex gap-1"><input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="student" /><input className="input py-1" name="email" type="email" placeholder={t("student email")} required /><button className="btn-secondary btn-sm">{t("Create")}</button></ActionForm>
              )}
            </li>
          </ul>
          {isAdmin && (
            <details className="mt-4"><summary className="cursor-pointer text-sm text-brand">{t("Add parent")}</summary>
              <form action={addParent} className="grid-form mt-3">
                <input type="hidden" name="id" value={s.id} />
                <input className="input" name="firstName" placeholder={t("First name")} required />
                <input className="input" name="lastName" placeholder={t("Last name")} required />
                <input className="input" name="email" type="email" placeholder={t("Email")} required />
                <input className="input" name="phone" placeholder={t("Phone")} />
                <button className="btn-secondary">{t("Add")}</button>
              </form>
            </details>
          )}
          {isAdmin && s.feeInvoices.length > 0 && (
            <>
              <h3 className="label mt-5">{t("Tuition")}</h3>
              <ul className="text-sm">{s.feeInvoices.map((f) => <li key={f.id} className="flex justify-between py-0.5"><span>{f.period} · {money(f.amountCts, club.currency)}</span><Pill v={f.paidAt ? "paid" : f.dueDate < new Date() ? "overdue" : "unpaid"} /></li>)}</ul>
              <Link className="text-sm text-brand" href="/admin/payments">{t("All payments →")}</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
