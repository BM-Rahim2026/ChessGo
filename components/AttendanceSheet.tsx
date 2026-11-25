"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Attendance sheet: colour-coded status buttons per child, "all present", live counts and a
// save bar that shows when there are unsaved changes. Posts the same fields as before (s_<id>).

export type SheetStudent = { id: string; name: string; inactive: boolean; mark: string | null };
type Labels = {
  present: string; late: string; absent: string; excused: string; clear: string; allPresent: string;
  topic: string; topicPh: string; save: string; saveNew: string; unsaved: string; nothingChanged: string;
  inactive: string; notMarked: string; counts: string;
};

const STYLE: Record<string, { on: string; dot: string }> = {
  present: { on: "border-chess bg-chess text-forest", dot: "bg-chess" },
  late: { on: "border-go bg-go text-forest", dot: "bg-go" },
  absent: { on: "border-red-600 bg-red-600 text-white", dot: "bg-red-600" },
  excused: { on: "border-sky-600 bg-sky-600 text-white", dot: "bg-sky-600" },
};
const ORDER = ["present", "late", "absent", "excused"] as const;

export function AttendanceSheet({ action, groupId, date, topic, students, saved, labels }: {
  action: (fd: FormData) => Promise<void>; groupId: string; date: string; topic: string;
  students: SheetStudent[]; saved: boolean; labels: Labels;
}) {
  // New lesson: everyone starts as present. Saved lesson: what was saved (or nothing).
  const initial = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.mark ?? (saved ? "none" : "present")])), [students, saved]);
  const [marks, setMarks] = useState<Record<string, string>>(initial);
  const [topicVal, setTopic] = useState(topic);
  const [busy, setBusy] = useState(false);
  const dirty = !saved || topicVal !== topic || students.some((s) => marks[s.id] !== initial[s.id]);
  const count = (k: string) => Object.values(marks).filter((m) => m === k).length;

  return (
    <form action={action} onSubmit={() => setBusy(true)} className="space-y-4">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="date" value={date} />
      {students.map((s) => <input key={s.id} type="hidden" name={`s_${s.id}`} value={marks[s.id]} />)}

      <label className="block">
        <span className="label">{labels.topic}</span>
        <input className="input" name="topic" value={topicVal} onChange={(e) => setTopic(e.target.value)} placeholder={labels.topicPh} />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-sm" aria-live="polite">
          {ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1">
              <span className={`h-2.5 w-2.5 rounded-full ${STYLE[k].dot}`} />{labels[k]}: <b>{count(k)}</b>
            </span>
          ))}
          {count("none") > 0 && <span className="inline-flex items-center rounded-full bg-cream px-3 py-1">{labels.notMarked}: <b className="ml-1">{count("none")}</b></span>}
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.id, "present"])))}>✓ {labels.allPresent}</button>
      </div>

      <ul className="divide-y divide-ink/10 rounded-card border border-ink/10 bg-white">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <span className="min-w-[9rem] flex-1 font-semibold text-ink">
              {s.name}
              {s.inactive && <span className="ml-2 pill text-xs">{labels.inactive}</span>}
              {marks[s.id] === "none" && <span className="ml-2 text-xs font-normal text-ink-soft">({labels.notMarked})</span>}
            </span>
            <span className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={s.name}>
              {ORDER.map((k) => {
                const on = marks[s.id] === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on}
                    onClick={() => setMarks((m) => ({ ...m, [s.id]: k }))}
                    className={`min-h-[40px] rounded-control border px-3 text-sm font-semibold ${on ? STYLE[k].on : "border-ink/20 bg-white text-ink hover:bg-mint"}`}>
                    {labels[k]}
                  </button>
                );
              })}
              {saved && marks[s.id] !== "none" && (
                <button type="button" title={labels.clear} aria-label={`${labels.clear}: ${s.name}`}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: "none" }))}
                  className="min-h-[40px] rounded-control px-2 text-ink-soft hover:bg-red-50 hover:text-red-700">✕</button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink/10 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-3 md:mr-40">
        <span className={`text-sm font-semibold ${dirty ? "text-red-700" : "text-ink-soft"}`}>{dirty ? `● ${labels.unsaved}` : labels.nothingChanged}</span>
        <button className="btn btn-lg" disabled={busy || !dirty}>{busy ? "…" : saved ? labels.save : labels.saveNew}</button>
      </div>
    </form>
  );
}

/** Pick another day: opens it right away (no extra button). */
export function DateJump({ groupId, date, label }: { groupId: string; date: string; label: string }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="font-semibold text-forest">{label}</span>
      <input className="input w-auto py-1" type="date" defaultValue={date}
        onChange={(e) => { if (e.target.value) router.push(`/admin/attendance?group=${groupId}&date=${e.target.value}`); }} />
    </label>
  );
}
