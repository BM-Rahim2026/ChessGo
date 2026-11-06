"use client";
import { useActionState, useMemo, useState } from "react";
import { FIELDS, autoMap, normalizeRows, parseCsv, type Field, type Mapping } from "@/lib/importer";
import type { ImportSummary } from "@/lib/importRun";
import { makeT, type Locale } from "@/lib/i18n/core";

type Result = { ok: true; summary: ImportSummary } | { ok: false; message: string } | null;

export function ImportClient({ action, groups, locale }: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  groups: { id: string; name: string }[];
  locale: Locale;
}) {
  const t = makeT(locale);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<Mapping>({});
  const [state, formAction, pending] = useActionState(action, null);

  const rows = useMemo(() => (csv ? parseCsv(csv) : []), [csv]);
  const headers = rows[0] ?? [];
  const preview = useMemo(() => (rows.length ? normalizeRows(rows, mapping) : []), [rows, mapping]);
  const errors = preview.filter((r) => r.errors.length).length;
  const warnings = preview.filter((r) => r.warnings.length).length;
  const groupNames = [...new Set(preview.map((r) => r.group).filter(Boolean))] as string[];
  const known = new Set(groups.map((g) => g.name.toLowerCase().trim()));
  const newGroups = groupNames.filter((g) => !known.has(g.toLowerCase().trim()));

  async function load(file: File) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // older Excel exports
    const parsed = parseCsv(text);
    setFileName(file.name);
    setCsv(text);
    setMapping(autoMap(parsed[0] ?? []));
  }

  if (state?.ok) {
    const s = state.summary;
    return (
      <div className="card space-y-3">
        <h2 className="h2">{t("Import finished")}</h2>
        <ul className="text-sm">
          <li>✅ {t("{a} students created, {b} linked to a parent", { a: s.created, b: s.parentsLinked })}</li>
          {s.groupsCreated.length > 0 && <li>➕ {t("New groups: {list} (set their capacity, fee and schedule in Groups)", { list: s.groupsCreated.join(", ") })}</li>}
          {s.skipped > 0 && <li>↷ {t("{n} skipped because they already exist", { n: s.skipped })}</li>}
          {s.failed > 0 && <li>⚠ {t("{n} rows could not be imported", { n: s.failed })}</li>}
        </ul>
        {s.details.length > 0 && <details><summary className="cursor-pointer text-sm text-brand">{t("Details")}</summary><ul className="muted mt-2 max-h-60 overflow-y-auto">{s.details.map((d, i) => <li key={i}>{t(d.m, d.v)}</li>)}</ul></details>}
        <div className="flex gap-2"><a className="btn" href="/admin/students">{t("View students")}</a><a className="btn-secondary" href="/admin/import">{t("Import another file")}</a></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="h2 mb-2">{t("1. Choose the file")}</h2>
        <p className="muted mb-3">{t("A CSV export (from SportBM, Excel or Google Sheets) with one student per row. Comma or semicolon separated.")}</p>
        <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} className="block w-full max-w-full text-base" />
        {fileName && <p className="muted mt-2">{fileName}: {t("{r} rows, {c} columns", { r: rows.length - 1, c: headers.length })}</p>}
      </div>

      {headers.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">{t("2. Check the columns")}</h2>
          <p className="muted mb-3">{t("Detected automatically. Correct anything that's wrong. Use either first + last name columns or one full-name column.")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(FIELDS) as Field[]).map((f) => (
              <label key={f} className="block">
                <span className="label">{t(FIELDS[f])}</span>
                <select className="input" value={mapping[f] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                  <option value="">{t("— not in file —")}</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `${t("Column")} ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">{t("3. Preview")}</h2>
          <p className="mb-3 text-sm">
            {t("{n} ready to import", { n: preview.length - errors })}{errors > 0 && <span className="text-red-700"> · {t("{n} with errors (will be skipped)", { n: errors })}</span>}
            {warnings > 0 && <span className="text-amber-700"> · {t("{n} with warnings", { n: warnings })}</span>}
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="table">
              <thead><tr><th>{t("Line")}</th><th>{t("Student")}</th><th>{t("Born")}</th><th>{t("Group")}</th><th>{t("Status")}</th><th>{t("Parent")}</th><th>{t("Email")}</th><th>{t("Issues")}</th></tr></thead>
              <tbody>{preview.slice(0, 200).map((r) => (
                <tr key={r.line} className={r.errors.length ? "bg-red-50" : r.warnings.length ? "bg-amber-50" : ""}>
                  <td className="muted">{r.line}</td><td>{r.studentFirst} {r.studentLast}</td><td>{r.birthDate ?? "—"}</td><td>{r.group ?? "—"}</td>
                  <td>{r.active ? t("status:active") : t("status:inactive")}</td><td>{r.parentEmail ? `${r.parentFirst} ${r.parentLast}` : "—"}</td><td>{r.parentEmail ?? "—"}</td>
                  <td className="text-xs">{[...r.errors, ...r.warnings].map((w) => t(w.m, w.v)).join("; ")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {preview.length > 200 && <p className="muted mt-2">{t("Showing the first 200 rows.")}</p>}

          <form action={formAction} className="mt-5 space-y-3 border-t border-ink/10 pt-4">
            <input type="hidden" name="csv" value={csv} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            {newGroups.length > 0 && (
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="createGroups" defaultChecked className="mt-1" />
                <span>{t("Create new groups ({n})", { n: newGroups.length })}: {newGroups.join(", ")}</span></label>
            )}
            <label className="block max-w-sm"><span className="label">{t("Group for students without one")}</span>
              <select className="input" name="defaultGroupId" defaultValue=""><option value="">{t("No group")}</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </label>
            {state && !state.ok && <p className="rounded-control bg-red-50 p-2 text-sm text-red-800">{state.message}</p>}
            <button className="btn" disabled={pending || preview.length - errors === 0}>{pending ? t("Importing…") : t("Import {n} students", { n: preview.length - errors })}</button>
          </form>
        </div>
      )}
    </div>
  );
}
