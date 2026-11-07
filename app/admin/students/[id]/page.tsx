import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Stat } from "@/components/ui";
import { fmtDate, money, str, optStr, dayKey, validParent, PHONE_PATTERN } from "@/lib/format";
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
      planId: await (async () => { const pid = optStr(fd.get("planId")); return pid && (await db.plan.findFirst({ where: { id: pid, clubId } })) ? pid : null; })(),
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
  const parent = { firstName: str(fd.get("firstName")), lastName: str(fd.get("lastName")), email: str(fd.get("email")), phone: str(fd.get("phone")) };
  if (!validParent(parent)) redirect(`/admin/students/${s.id}?err=parent`);
  const p = await findOrCreateParent(clubId, parent);
  await db.studentParent.upsert({ where: { studentId_parentId: { studentId: s.id, parentId: p.id } }, update: {}, create: { studentId: s.id, parentId: p.id } });
  revalidatePath(`/admin/students/${s.id}`);
}

async function updateParent(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const sid = str(fd.get("id"));
  const parent = { firstName: str(fd.get("firstName")), lastName: str(fd.get("lastName")), email: str(fd.get("email")).toLowerCase(), phone: str(fd.get("phone")) };
  if (!validParent(parent)) redirect(`/admin/students/${sid}?err=parent`);
  const existing = await db.parent.findFirst({ where: { id: str(fd.get("parentId")), clubId } });
  if (!existing) redirect(`/admin/students/${sid}`);
  if (parent.email !== existing.email && (await db.parent.findFirst({ where: { clubId, email: parent.email, NOT: { id: existing.id } } }))) {
    redirect(`/admin/students/${sid}?err=email`);
  }
  await db.parent.update({ where: { id: existing.id }, data: parent });
  redirect(`/admin/students/${sid}?saved=parent`);
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

async function deleteStudent(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff(true);
  const s = await db.student.findFirst({ where: { id: str(fd.get("id")), clubId }, include: { user: true } });
  if (!s) redirect("/admin/students");
  const full = `${s.firstName} ${s.lastName}`;
  // Second check on the server: the typed name must match.
  if (str(fd.get("confirm")).trim().toLowerCase() !== full.trim().toLowerCase()) redirect(`/admin/students/${s.id}`);
  await db.$transaction([
    db.formSubmission.updateMany({ where: { clubId, convertedStudentId: s.id }, data: { convertedStudentId: null, status: "archived" } }),
    db.student.delete({ where: { id: s.id } }), // attendance, XP, badges, payments, tournament games cascade
    ...(s.user?.role === "student" ? [db.user.delete({ where: { id: s.user.id } })] : []),
  ]);
  redirect(`/admin/students?deleted=${encodeURIComponent(full)}`);
}

export default async function StudentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string; saved?: string }> }) {
  const t = await getT();
  const sp = await searchParams;
  const { clubId, club, user } = await requireStaff();
  const { id } = await params;
  const s = await db.student.findFirst({
    where: { id, clubId },
    include: {
      group: true, user: true, parents: { include: { parent: { include: { user: true } } } },
      badges: { include: { badge: true }, orderBy: { earnedAt: "desc" } },
      xpEvents: { orderBy: { createdAt: "desc" }, take: 25, include: { awardedBy: true } },
      feeInvoices: { orderBy: { period: "desc" }, take: 6 },
      _count: { select: { attendance: true, feeInvoices: true, xpEvents: true, entries: true } },
    },
  });
  if (!s) notFound();
  await evaluateBadges(s.id);
  const [groups, badges, m, plans] = await Promise.all([
    db.group.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    db.badge.findMany({ where: { clubId }, orderBy: { name: "asc" } }),
    studentMetrics(s.id),
    db.plan.findMany({ where: { clubId, active: true }, orderBy: { priceCts: "asc" } }),
  ]);
  const isAdmin = user.role === "club_admin";
  const owned = new Set(s.badges.map((b) => b.badgeId));

  return (
    <div>
      <PageHeader title={`${s.firstName} ${s.lastName}`} sub={`${s.group?.name ?? t("No group")} · ${t("joined")} ${fmtDate(s.joinedAt)}`}>
        <LeagueBadge level={Math.floor(s.xp / 100) + 1} />
        <Pill v={s.status} />
      </PageHeader>
      {sp.err === "parent" && <div className="card mb-4 text-sm text-red-800">{t("Parent first name, last name, email and phone number are required.")}</div>}
      {sp.err === "email" && <div className="card mb-4 text-sm text-red-800">{t("Another parent in the club already uses this email.")}</div>}
      {sp.saved === "parent" && <div className="card mb-4 text-sm text-forest">{t("Parent details saved.")}</div>}
      {s.parents.length === 0 && <div className="card mb-4 border-l-4 border-go text-sm">{t("This student has no parent yet — add a parent with name, email and phone below.")}</div>}

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
            <form key={`${s.firstName}|${s.lastName}|${s.groupId}|${s.status}|${s.birthDate?.toISOString()}|${s.notes}|${s.planId}`} action={updateStudent} className="grid-form">
              <input type="hidden" name="id" value={s.id} />
              <Field label={t("First name")}><input className="input" name="firstName" defaultValue={s.firstName} required /></Field>
              <Field label={t("Last name")}><input className="input" name="lastName" defaultValue={s.lastName} required /></Field>
              <Field label={t("Birth date")}><input className="input" type="date" name="birthDate" defaultValue={s.birthDate?.toISOString().slice(0, 10)} /></Field>
              <Field label={t("Group")}><select className="input" name="groupId" defaultValue={s.groupId ?? ""}><option value="">—</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
              <Field label={t("Price plan")}>
                <select className="input" name="planId" defaultValue={s.planId ?? ""}>
                  <option value="">{t("Group monthly fee")}</option>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.priceCts, club.currency)} / {t(`interval:${p.interval}`)}</option>)}
                </select>
              </Field>
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
                <span className="min-w-0 break-words">{p.firstName} {p.lastName} · {p.email} · {p.phone ? p.phone : <span className="pill bg-red-50 text-red-800">{t("phone missing")}</span>}</span>
                {p.user ? (
                  <span className="flex items-center gap-2"><span className="pill pill-green">{t("has login")}</span>{isAdmin && <ActionForm action={resetPw}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="userId" value={p.user.id} /><button className="text-xs text-ink-soft underline">{t("Reset password")}</button></ActionForm>}</span>
                ) : isAdmin && (
                  <ActionForm action={makeLogin}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="kind" value="parent" /><input type="hidden" name="parentId" value={p.id} /><button className="btn-secondary btn-sm">{t("Create parent login")}</button></ActionForm>
                )}
                {isAdmin && (
                  <details className="w-full" open={!p.phone}>
                    <summary className="cursor-pointer text-xs text-ink-soft underline">{t("Edit parent details")}</summary>
                    <form key={`${p.firstName}|${p.lastName}|${p.email}|${p.phone}`} action={updateParent} className="grid-form mt-2">
                      <input type="hidden" name="id" value={s.id} /><input type="hidden" name="parentId" value={p.id} />
                      <Field label={t("First name") + " *"}><input className="input" name="firstName" required maxLength={80} defaultValue={p.firstName} /></Field>
                      <Field label={t("Last name") + " *"}><input className="input" name="lastName" required maxLength={80} defaultValue={p.lastName} /></Field>
                      <Field label={t("Email") + " *"}><input className="input" name="email" type="email" required defaultValue={p.email} /></Field>
                      <Field label={t("Phone") + " *"}><input className="input" name="phone" type="tel" required pattern={PHONE_PATTERN} title={t("Phone number, at least 9 digits")} maxLength={40} defaultValue={p.phone ?? ""} /></Field>
                      <div className="sm:col-span-2 flex justify-end"><button className="btn-secondary">{t("Save")}</button></div>
                    </form>
                  </details>
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
                <input className="input" name="phone" type="tel" placeholder={t("Phone")} required pattern={PHONE_PATTERN} title={t("Phone number, at least 9 digits")} maxLength={40} />
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
      {isAdmin && (
        <div className="card mt-6 border border-red-200">
          <h2 className="h2 mb-1 text-red-900">{t("Delete student")}</h2>
          <p className="muted mb-3 text-sm">{t("If the student just stopped attending, set the status to inactive instead — that keeps their history.")}</p>
          <ConfirmDelete action={deleteStudent} id={s.id} name={`${s.firstName} ${s.lastName}`} labels={{
            open: t("Delete student…"), title: t("Delete {name} permanently? This cannot be undone.", { name: `${s.firstName} ${s.lastName}` }),
            typeToConfirm: t("To confirm, type the student's full name:"), confirm: t("Delete permanently"), cancel: t("Cancel"),
          }} warnings={[
            t("{n} attendance records will be deleted.", { n: s._count.attendance }),
            t("{n} tuition payments (paid and unpaid) will be deleted.", { n: s._count.feeInvoices }),
            t("All XP, badges and {n} tournament entries will be deleted.", { n: s._count.entries }),
            ...(s.user ? [t("The student's login will be deleted.")] : []),
            t("Parent accounts are kept."),
          ]} />
        </div>
      )}
    </div>
  );
}
