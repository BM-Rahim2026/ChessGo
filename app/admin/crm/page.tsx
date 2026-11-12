import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { dayKey, fmtDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import {
  MAX_TOUCHES, ON_HOLD_MONTHS, ROLES, SCHOOL_TYPES, STAGES, WEEKLY_TARGETS, needsFollowUp, nextWorkday, weeklyKpis,
} from "@/lib/crm";
import { addSchool } from "./actions";

export const dynamic = "force-dynamic";

function Kpi({ label, value, min, max, hint }: { label: string; value: number; min: number; max?: number; hint: string }) {
  const pct = Math.min(100, Math.round((value / (max ?? min)) * 100));
  const ok = value >= min;
  return (
    <div className="card">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold text-forest">{value}<span className="text-base font-normal text-ink-soft"> / {max ? `${min}–${max}` : min}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint"><div className={`h-full rounded-full ${ok ? "bg-chess" : "bg-go"}`} style={{ width: `${pct}%` }} /></div>
      <div className="mt-1 text-xs text-ink-soft">{hint}</div>
    </div>
  );
}

export default async function Crm({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; err?: string; deleted?: string }> }) {
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const sp = await searchParams;
  const today = dayKey();
  const q = sp.q?.trim();
  const [leads, kpi, signups] = await Promise.all([
    db.schoolLead.findMany({
      where: {
        clubId,
        ...(sp.type ? { schoolType: sp.type } : {}),
        ...(q ? { OR: [{ schoolName: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ nextFollowUp: "asc" }, { schoolName: "asc" }],
    }),
    weeklyKpis(clubId),
    db.formSubmission.groupBy({ by: ["schoolLeadId"], where: { clubId, schoolLeadId: { not: null } }, _count: true }),
  ]);
  const signupsBy = new Map(signups.map((s) => [s.schoolLeadId, s._count]));
  const kids = (l: (typeof leads)[number]) => Math.max(l.registeredKids, signupsBy.get(l.id) ?? 0);
  const due = leads.filter((l) => needsFollowUp(l.status) && l.nextFollowUp && l.nextFollowUp <= today);
  const missing = leads.filter((l) => needsFollowUp(l.status) && !l.nextFollowUp);
  const holdDue = leads.filter((l) => l.status === "on_hold" && l.nextFollowUp && l.nextFollowUp <= today);
  const typeLabel = (k: string) => t(SCHOOL_TYPES.find((x) => x.key === k)?.label ?? k);

  return (
    <div>
      <PageHeader title={t("Schools CRM")} sub={t("Pipeline of schools: from the first call to an active chess group.")} />
      {sp.err === "name" && <div className="card mb-4 text-sm text-red-800">{t("Enter the school name.")}</div>}
      {sp.deleted && <div className="card mb-4 text-sm text-forest">{t("School removed from the CRM.")}</div>}

      <h2 className="h2 mb-2">{t("This week")} <span className="text-sm font-normal text-ink-soft">({t("from")} {fmtDate(new Date(`${kpi.weekStart}T12:00:00Z`))})</span></h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Kpi label={t("Calls")} value={kpi.calls} min={WEEKLY_TARGETS.callsMin} max={WEEKLY_TARGETS.callsMax} hint={t("Answered and unanswered calls")} />
        <Kpi label={t("Open Days done")} value={kpi.openDays} min={WEEKLY_TARGETS.openDaysMin} max={WEEKLY_TARGETS.openDaysMax} hint={t("Schools moved to “Open Day done”")} />
        <Kpi label={t("New active groups")} value={kpi.newGroups} min={WEEKLY_TARGETS.newGroups} hint={t("Schools moved to “Active group”")} />
      </div>

      {(due.length > 0 || missing.length > 0 || holdDue.length > 0) && (
        <div className="card mb-6 border-l-4 border-go">
          <h2 className="h2 mb-2">{t("To do today")}</h2>
          <ul className="divide-y divide-ink/5 text-sm">
            {missing.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b className="text-red-700">⚠ {t("No follow-up date")}</b> · <Link className="underline" href={`/admin/crm/${l.id}`}>{l.schoolName}</Link></span>
                <span className="pill">{t(STAGES.find((s) => s.key === l.status)?.label ?? l.status)}</span>
              </li>
            ))}
            {due.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <b className={l.nextFollowUp! < today ? "text-red-700" : "text-forest"}>{l.nextFollowUp! < today ? `${t("Overdue")} (${l.nextFollowUp})` : t("Call today")}</b>
                  {" · "}<Link className="underline" href={`/admin/crm/${l.id}`}>{l.schoolName}</Link>
                  {l.contactName && <span className="text-ink-soft"> · {l.contactName}</span>}
                  {l.phone && <> · <a className="underline" href={`tel:${l.phone.replace(/\s/g, "")}`}>{l.phone}</a></>}
                </span>
                <span className="flex items-center gap-2">
                  {l.failedCalls > 0 && <span className="pill">{t("Try")} {l.failedCalls + 1}/{MAX_TOUCHES}</span>}
                  <span className="pill">{t(STAGES.find((s) => s.key === l.status)?.label ?? l.status)}</span>
                </span>
              </li>
            ))}
            {holdDue.map((l) => (
              <li key={l.id} className="py-2"><b className="text-forest">{t("Back from hold")}</b> · <Link className="underline" href={`/admin/crm/${l.id}`}>{l.schoolName}</Link> — {t("try again")}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="h2">{t("Pipeline")} <span className="text-sm font-normal text-ink-soft">({leads.length})</span></h2>
        <form className="flex flex-wrap gap-2">
          <input className="input w-48" name="q" defaultValue={q} placeholder={t("Search school, city, person")} />
          <select className="input w-44" name="type" defaultValue={sp.type ?? ""}>
            <option value="">{t("All types")}</option>
            {SCHOOL_TYPES.map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}
          </select>
          <button className="btn-secondary">{t("Filter")}</button>
        </form>
      </div>
      <div className="-mx-4 mb-8 overflow-x-auto px-4 pb-2">
        <div className="flex min-w-max gap-3">
          {STAGES.map((st) => {
            const col = leads.filter((l) => l.status === st.key);
            return (
              <div key={st.key} className={`w-64 shrink-0 rounded-card p-2 ${st.key === "on_hold" ? "bg-ink/5" : st.key === "active" ? "bg-mint" : "bg-white/70"}`}>
                <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-forest">
                  <span>{st.n ? `${st.n}. ` : ""}{t(st.label)}</span><span className="pill">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((l) => {
                    const late = needsFollowUp(l.status) && (!l.nextFollowUp || l.nextFollowUp < today);
                    const k = kids(l);
                    return (
                      <Link key={l.id} href={`/admin/crm/${l.id}`} className="block rounded-control border border-ink/10 bg-white p-3 text-sm shadow-sm hover:border-forest/40">
                        <div className="font-semibold text-forest">{l.schoolName}</div>
                        <div className="text-xs text-ink-soft">{[l.city, typeLabel(l.schoolType)].filter(Boolean).join(" · ")}</div>
                        {l.contactName && <div className="mt-1 truncate text-xs">{l.contactName}</div>}
                        <div className="mt-2 flex flex-wrap gap-1 text-xs">
                          {l.nextFollowUp && <span className={`pill ${late ? "bg-red-50 text-red-800" : ""}`}>📞 {l.nextFollowUp}</span>}
                          {!l.nextFollowUp && needsFollowUp(l.status) && <span className="pill bg-red-50 text-red-800">⚠ {t("no date")}</span>}
                          {l.openDayDate && <span className="pill">🎪 {l.openDayDate}</span>}
                          {["open_day_done", "signups", "active"].includes(l.status) && <span className={`pill ${k >= l.targetKids ? "pill-green" : ""}`}>👧 {k}/{l.targetKids}</span>}
                          {l.failedCalls > 0 && <span className="pill">✗ {l.failedCalls}/{MAX_TOUCHES}</span>}
                        </div>
                      </Link>
                    );
                  })}
                  {col.length === 0 && <p className="px-1 text-xs text-ink-soft">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="h2 mb-3">{t("Add school")}</h2>
          <form action={addSchool} className="grid-form">
            <Field label={t("School name") + " *"}><input className="input" name="schoolName" required maxLength={160} /></Field>
            <Field label={t("Type")}><select className="input" name="schoolType">{SCHOOL_TYPES.map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}</select></Field>
            <Field label={t("City")}><input className="input" name="city" maxLength={80} /></Field>
            <Field label={t("Country")}><input className="input" name="country" defaultValue="Polska" maxLength={80} /></Field>
            <Field label={t("Decision maker")}><input className="input" name="contactName" maxLength={120} /></Field>
            <Field label={t("Role")}><select className="input" name="contactRole"><option value="">—</option>{ROLES.map((r) => <option key={r.key} value={r.key}>{t(r.label)}</option>)}</select></Field>
            <Field label={t("Phone")}><input className="input" name="phone" type="tel" maxLength={40} /></Field>
            <Field label="WhatsApp"><input className="input" name="whatsapp" type="tel" maxLength={40} /></Field>
            <Field label={t("Email")}><input className="input" name="email" type="email" maxLength={160} /></Field>
            <Field label={t("Next follow-up") + " *"}><input className="input" name="nextFollowUp" type="date" required defaultValue={nextWorkday()} /></Field>
            <Field label={t("Notes")} className="sm:col-span-2"><textarea className="input" name="notes" rows={2} /></Field>
            <div className="sm:col-span-2 flex justify-end"><button className="btn">{t("Add school")}</button></div>
          </form>
        </div>
        <div className="card">
          <h2 className="h2 mb-2">{t("Playbook")}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
            <li><b>{t("Call + Email")}:</b> {t("call the Principal or ECA Coordinator, pitch a free 30-minute Chess Open Day (zero cost and hassle for the school) and send the 1-page summary email.")}</li>
            <li><b>{t("Open Day")}:</b> {t("lock in the date, send flyers/posters 3 days before and confirm 24 hours before. After the workshop hand out flyers with the QR code for parent registration.")}</li>
            <li><b>{t("Sign-ups & Launch")}:</b> {t("ask the school to share the registration link with parents. Once 8+ kids sign up, confirm the room and coach and message parents with the start date.")}</li>
          </ol>
          <h3 className="mt-4 font-semibold text-forest">{t("Golden rules")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink">
            <li><b>{t("No empty dates")}:</b> {t("every active lead must have a next follow-up date (the CRM will not save without it).")}</li>
            <li><b>{t("5-touch rule")}:</b> {t("call up to {n} times at different hours. No answer after {n} tries = On hold for {m} months (automatic).", { n: MAX_TOUCHES, m: ON_HOLD_MONTHS })}</li>
            <li><b>{t("Weekly target")}:</b> {t("{a}–{b} calls → {c}–{d} Open Days → {e} new active chess groups.", { a: WEEKLY_TARGETS.callsMin, b: WEEKLY_TARGETS.callsMax, c: WEEKLY_TARGETS.openDaysMin, d: WEEKLY_TARGETS.openDaysMax, e: WEEKLY_TARGETS.newGroups })}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
