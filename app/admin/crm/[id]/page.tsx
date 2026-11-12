import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { CopyLink } from "@/components/CopyLink";
import { dayKey, weekday } from "@/lib/format";
import { emailEnabled } from "@/lib/email";
import { getT } from "@/lib/i18n/server";
import {
  MAX_TOUCHES, PHASES, ROLES, SCHOOL_TYPES, STAGES, addDays, needsFollowUp, nextWorkday, offerEmail, registrationLink,
} from "@/lib/crm";
import { addNote, callAnswered, createGroup, deleteSchool, noAnswer, saveSchool, sendOffer, toggleStep } from "../actions";

export const dynamic = "force-dynamic";

const ACT_ICON: Record<string, string> = { call: "📞", no_answer: "✗", email: "✉", note: "📝", status: "➜" };

export default async function School({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; err?: string; done?: string }>;
}) {
  const t = await getT();
  const { clubId, club, user } = await requireStaff(true);
  const { id } = await params;
  const sp = await searchParams;
  const l = await db.schoolLead.findFirst({ where: { id, clubId }, include: { activities: { orderBy: { createdAt: "desc" }, take: 60 } } });
  if (!l) notFound();
  const [coaches, signups, group, users] = await Promise.all([
    db.user.findMany({ where: { clubId, role: { in: ["coach", "club_admin"] } }, orderBy: { name: "asc" } }),
    db.formSubmission.count({ where: { clubId, schoolLeadId: l.id } }),
    l.groupId ? db.group.findFirst({ where: { id: l.groupId, clubId } }) : null,
    db.user.findMany({ where: { clubId }, select: { id: true, name: true } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const today = dayKey();
  const done = (l.checklist as Record<string, string> | null) ?? {};
  const kids = Math.max(l.registeredKids, signups);
  const link = registrationLink(club.slug, l.id);
  const qr = await QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#0B3D2E", light: "#FFFFFF" } });
  const stage = STAGES.find((s) => s.key === l.status)!;
  const phaseNow = PHASES.find((p) => (p.stages as readonly string[]).includes(l.status))?.key;
  const mail = offerEmail({ clubName: club.name, contactName: l.contactName, schoolName: l.schoolName, senderName: user.name, phone: club.phone, site: process.env.LEGAL_SITE || "chessgo.pl" });

  // Warnings from the playbook and golden rules.
  const warn: string[] = [];
  if (needsFollowUp(l.status) && !l.nextFollowUp) warn.push(t("No next follow-up date — every active lead needs one."));
  else if (needsFollowUp(l.status) && l.nextFollowUp! < today) warn.push(t("Follow-up is overdue (was {d}).", { d: l.nextFollowUp! }));
  if (l.openDayDate && l.openDayDate >= today) {
    if (l.openDayDate <= addDays(today, 3) && !done.flyers_sent) warn.push(t("Open Day in 3 days or less: send flyers/posters now."));
    if (l.openDayDate <= addDays(today, 1) && !done.confirmed_24h) warn.push(t("Open Day tomorrow or today: confirm with the school."));
  }
  if (l.status === "open_day_scheduled" && l.openDayDate && l.openDayDate < today) warn.push(t("The Open Day date has passed — move the school to “Open Day done”."));
  if (kids >= l.targetKids && !["active", "on_hold"].includes(l.status)) warn.push(t("{n} kids signed up — confirm room and coach and launch the group!", { n: kids }));

  const typeLabel = SCHOOL_TYPES.find((x) => x.key === l.schoolType)?.label ?? l.schoolType;
  const roleLabel = ROLES.find((r) => r.key === l.contactRole)?.label;

  return (
    <div>
      <PageHeader title={l.schoolName} sub={[l.city, l.country, t(typeLabel)].filter(Boolean).join(" · ")}>
        <Link href="/admin/crm" className="btn-secondary">← {t("Pipeline")}</Link>
      </PageHeader>

      {/* Stage progress */}
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-1 text-xs">
          {STAGES.filter((s) => s.n > 0).map((s) => (
            <li key={s.key} className={`rounded-full px-3 py-1 font-semibold ${s.key === l.status ? "bg-forest text-white" : stage.n > s.n ? "bg-mint text-forest" : "bg-white text-ink-soft"}`}>{s.n}. {t(s.label)}</li>
          ))}
          {l.status === "on_hold" && <li className="rounded-full bg-ink/80 px-3 py-1 font-semibold text-white">{t("On hold")}</li>}
        </ol>
      </div>

      {sp.saved && <div className="card mb-4 text-sm text-forest">{t("Saved.")}</div>}
      {sp.done === "call" && <div className="card mb-4 text-sm text-forest">{t("Call logged.")}</div>}
      {sp.done === "noanswer" && <div className="card mb-4 text-sm text-forest">{t("No answer logged ({n}/{max}). Try again at a different hour — follow-up set to {d}.", { n: l.failedCalls, max: MAX_TOUCHES, d: l.nextFollowUp ?? "" })}</div>}
      {sp.done === "hold" && <div className="card mb-4 text-sm text-forest">{t("5 calls without an answer: the school is now On hold until {d}.", { d: l.nextFollowUp ?? "" })}</div>}
      {sp.done === "email" && <div className="card mb-4 text-sm text-forest">{t("Summary email sent. You will find it in Poczta → Sent.")}</div>}
      {sp.done === "group" && <div className="card mb-4 text-sm text-forest">{t("Group created. Add the students in “Groups & schedule”.")}</div>}
      {sp.err === "followup" && <div className="card mb-4 text-sm text-red-800">{t("Set the next follow-up date — every active lead must have one.")}</div>}
      {sp.err === "name" && <div className="card mb-4 text-sm text-red-800">{t("Enter the school name.")}</div>}
      {sp.err === "email" && <div className="card mb-4 text-sm text-red-800">{t("Add the school's email address first.")}</div>}
      {sp.err === "send" && <div className="card mb-4 text-sm text-red-800">{t("Sending failed — check the email settings.")}</div>}
      {warn.length > 0 && (
        <div className="card mb-4 border-l-4 border-go text-sm">
          <ul className="space-y-1">{warn.map((w) => <li key={w}>⚠ {w}</li>)}</ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {/* Quick actions */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="h2">{t("Call")}</h2>
              <div className="text-sm">
                {l.contactName && <b>{l.contactName}</b>}{roleLabel && <span className="text-ink-soft"> · {t(roleLabel)}</span>}
                {l.phone && <> · <a className="font-semibold text-forest underline" href={`tel:${l.phone.replace(/\s/g, "")}`}>{l.phone}</a></>}
                {l.whatsapp && <> · <a className="text-forest underline" href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener">WhatsApp</a></>}
              </div>
            </div>
            <p className="muted mt-1 text-sm">{t("Attempts without an answer")}: {l.failedCalls}/{MAX_TOUCHES}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <form action={callAnswered} className="grid gap-2 rounded-control bg-mint/60 p-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={l.id} />
                <Field label={t("Call summary")} className="sm:col-span-2"><input className="input" name="note" placeholder={t("e.g. interested, wants the offer by email")} /></Field>
                <Field label={t("Next follow-up") + " *"}><input className="input" type="date" name="nextFollowUp" required={needsFollowUp(l.status)} defaultValue={l.nextFollowUp && l.nextFollowUp > today ? l.nextFollowUp : nextWorkday()} /></Field>
                <Field label={t("Move to stage")}>
                  <select className="input" name="status" defaultValue={l.status === "lead" || l.status === "on_hold" ? "first_contact" : l.status}>
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.n ? `${s.n}. ` : ""}{t(s.label)}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2"><button className="btn">✓ {t("Call answered")}</button></div>
              </form>
              <form action={noAnswer} className="flex flex-col justify-center gap-2 rounded-control bg-ink/5 p-3 text-sm">
                <input type="hidden" name="id" value={l.id} />
                <button className="btn-secondary">✗ {t("No answer")}</button>
                <span className="max-w-[14rem] text-xs text-ink-soft">{t("After {n} tries the school goes On hold for 2 months automatically.", { n: MAX_TOUCHES })}</span>
              </form>
            </div>
          </div>

          {/* Workflow checklist */}
          <div className="card">
            <h2 className="h2 mb-3">{t("Step-by-step workflow")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {PHASES.map((p) => (
                <div key={p.key} className={`rounded-control p-3 ${p.key === phaseNow ? "bg-mint ring-2 ring-chess" : "bg-cream"}`}>
                  <h3 className="mb-2 font-semibold text-forest">{t(p.title)}</h3>
                  <ul className="space-y-1">
                    {p.steps.map((s) => (
                      <li key={s.key}>
                        <form action={toggleStep} className="flex items-start gap-2 text-sm">
                          <input type="hidden" name="id" value={l.id} /><input type="hidden" name="step" value={s.key} />
                          <button className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${done[s.key] ? "border-chess bg-chess text-white" : "border-ink/30 bg-white"}`} aria-label={t(s.label)}>{done[s.key] ? "✓" : ""}</button>
                          <span className={done[s.key] ? "text-ink-soft line-through" : ""}>{t(s.label)}{done[s.key] && <span className="ml-1 text-xs no-underline">({done[s.key]})</span>}</span>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="h2 mb-3">{t("School details")}</h2>
            <form key={l.updatedAt.toISOString()} action={saveSchool} className="space-y-5">
              <input type="hidden" name="id" value={l.id} />
              <fieldset className="grid-form"><legend className="label sm:col-span-2">{t("School & location")}</legend>
                <Field label={t("School name") + " *"}><input className="input" name="schoolName" required defaultValue={l.schoolName} /></Field>
                <Field label={t("Type")}><select className="input" name="schoolType" defaultValue={l.schoolType}>{SCHOOL_TYPES.map((x) => <option key={x.key} value={x.key}>{t(x.label)}</option>)}</select></Field>
                <Field label={t("City")}><input className="input" name="city" defaultValue={l.city ?? ""} /></Field>
                <Field label={t("Country")}><input className="input" name="country" defaultValue={l.country} /></Field>
              </fieldset>
              <fieldset className="grid-form"><legend className="label sm:col-span-2">{t("Decision maker")}</legend>
                <Field label={t("Name")}><input className="input" name="contactName" defaultValue={l.contactName ?? ""} /></Field>
                <Field label={t("Role")}><select className="input" name="contactRole" defaultValue={l.contactRole ?? ""}><option value="">—</option>{ROLES.map((r) => <option key={r.key} value={r.key}>{t(r.label)}</option>)}</select></Field>
                <Field label={t("Phone")}><input className="input" type="tel" name="phone" defaultValue={l.phone ?? ""} /></Field>
                <Field label="WhatsApp"><input className="input" type="tel" name="whatsapp" defaultValue={l.whatsapp ?? ""} /></Field>
                <Field label={t("Email")} className="sm:col-span-2"><input className="input" type="email" name="email" defaultValue={l.email ?? ""} /></Field>
              </fieldset>
              <fieldset className="grid-form"><legend className="label sm:col-span-2">{t("Pipeline & key dates")}</legend>
                <Field label={t("Pipeline status")}><select className="input" name="status" defaultValue={l.status}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.n ? `${s.n}. ` : ""}{t(s.label)}</option>)}</select></Field>
                <Field label={t("Next follow-up") + " *"}><input className="input" type="date" name="nextFollowUp" defaultValue={l.nextFollowUp ?? ""} /></Field>
                <Field label={t("Open Day date")}><input className="input" type="date" name="openDayDate" defaultValue={l.openDayDate ?? ""} /></Field>
                <Field label={t("Open Day time")}><input className="input" type="time" name="openDayTime" defaultValue={l.openDayTime ?? ""} /></Field>
              </fieldset>
              <fieldset className="grid-form"><legend className="label sm:col-span-2">{t("Operations")}</legend>
                <Field label={t("Registered kids")}><input className="input" type="number" min={0} name="registeredKids" defaultValue={l.registeredKids} /></Field>
                <Field label={t("Target (min.)")}><input className="input" type="number" min={1} name="targetKids" defaultValue={l.targetKids} /></Field>
                <Field label={t("Day")}><select className="input" name="scheduleDay" defaultValue={l.scheduleDay ?? ""}><option value="">—</option>{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{weekday(d)}</option>)}</select></Field>
                <Field label={t("Time")}><input className="input" type="time" name="scheduleTime" defaultValue={l.scheduleTime ?? ""} /></Field>
                <Field label={t("Room")}><input className="input" name="room" defaultValue={l.room ?? ""} /></Field>
                <Field label={t("Assigned coach")}><select className="input" name="coachId" defaultValue={l.coachId ?? ""}><option value="">—</option>{coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field label={t("Notes")} className="sm:col-span-2"><textarea className="input" name="notes" rows={3} defaultValue={l.notes ?? ""} /></Field>
              </fieldset>
              <div className="flex justify-end"><button className="btn">{t("Save")}</button></div>
            </form>
          </div>

          {/* Summary email */}
          <div className="card">
            <h2 className="h2 mb-1">{t("1-page summary email")}</h2>
            <p className="muted mb-3 text-sm">{t("Sent from kontakt@chessgo.pl; replies arrive in Poczta.")}</p>
            {!l.email ? <p className="text-sm text-red-800">{t("Add the school's email address first.")}</p> : (
              <form action={sendOffer} className="space-y-2">
                <input type="hidden" name="id" value={l.id} />
                <Field label={t("To")}><input className="input" value={l.email} readOnly /></Field>
                <Field label={t("Subject")}><input className="input" name="subject" defaultValue={mail.subject} /></Field>
                <textarea className="input min-h-72 font-sans" name="text" defaultValue={mail.text} />
                {emailEnabled()
                  ? <button className="btn">✉ {t("Send email")}</button>
                  : <a className="btn" href={`mailto:${l.email}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.text)}`}>✉ {t("Open in my email app")}</a>}
              </form>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Sign-ups */}
          <div className="card">
            <h2 className="h2 mb-1">{t("Parent sign-ups")}</h2>
            <div className="font-display text-4xl font-semibold text-forest">{kids}<span className="text-lg font-normal text-ink-soft"> / {l.targetKids}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-mint"><div className={`h-full ${kids >= l.targetKids ? "bg-chess" : "bg-go"}`} style={{ width: `${Math.min(100, (kids / l.targetKids) * 100)}%` }} /></div>
            <p className="muted mt-2 text-xs">{t("{n} through the school's registration link (counted automatically).", { n: signups })}</p>
            <div className="mt-3 rounded-control bg-white p-2" aria-label="QR" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="mt-2 break-all text-xs text-ink-soft">{link}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyLink url={link} label={t("Copy link")} done={t("Copied ✓")} />
              <a className="btn-secondary btn-sm" href={`/crm-flyer/${l.id}`} target="_blank" rel="noopener">🖨 {t("Print flyer")}</a>
            </div>
            {signups > 0 && <Link className="mt-2 block text-sm text-forest underline" href="/admin/inbox">{t("See the sign-ups in Inbox →")}</Link>}
          </div>

          {/* Group */}
          <div className="card">
            <h2 className="h2 mb-1">{t("Chess group")}</h2>
            <p className="text-sm text-ink">
              {l.scheduleDay ? `${weekday(l.scheduleDay)} ${l.scheduleTime ?? ""}` : t("No schedule yet")}{l.room ? ` · ${l.room}` : ""}
              {l.coachId ? ` · ${coaches.find((c) => c.id === l.coachId)?.name ?? ""}` : ""}
            </p>
            {group
              ? <Link className="btn-secondary btn-sm mt-3" href="/admin/groups">{t("Open group")}: {group.name} →</Link>
              : ["signups", "active", "open_day_done"].includes(l.status) && (
                <form action={createGroup} className="mt-3">
                  <input type="hidden" name="id" value={l.id} />
                  <button className="btn btn-sm">+ {t("Create the group in the system")}</button>
                  <p className="muted mt-1 text-xs">{t("Uses the day, time, room and coach above, and marks the school as Active group.")}</p>
                </form>
              )}
          </div>

          {/* History */}
          <div className="card">
            <h2 className="h2 mb-2">{t("History")}</h2>
            <form action={addNote} className="mb-3 flex gap-2">
              <input type="hidden" name="id" value={l.id} />
              <input className="input flex-1" name="note" placeholder={t("Add a note…")} maxLength={2000} />
              <button className="btn-secondary">{t("Add")}</button>
            </form>
            <ul className="space-y-2 text-sm">
              {l.activities.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span aria-hidden className="w-5 shrink-0 text-center">{ACT_ICON[a.type] ?? "•"}</span>
                  <span className="min-w-0">
                    <span className="text-xs text-ink-soft">{dayKey(a.createdAt)}{a.userId && who.get(a.userId) ? ` · ${who.get(a.userId)}` : ""}</span><br />
                    {a.type === "status" ? <b>{t(STAGES.find((s) => s.key === a.status)?.label ?? a.status ?? "")}</b> : a.type === "call" ? <b>{t("Call")}</b> : a.type === "no_answer" ? <b>{t("No answer")}</b> : a.type === "email" ? <b>{t("Email")}</b> : null}
                    {a.note && <span className="break-words"> {a.type !== "note" ? "— " : ""}{a.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card border border-red-200">
            <ConfirmDelete action={deleteSchool} id={l.id} name={l.schoolName} labels={{
              open: t("Delete school…"), title: t("Delete “{name}” from the CRM? Its history will be lost.", { name: l.schoolName }),
              typeToConfirm: t("To confirm, type the school name:"), confirm: t("Delete permanently"), cancel: t("Cancel"),
            }} warnings={[t("Students and groups already created are not affected.")]} />
          </div>
        </div>
      </div>
    </div>
  );
}
