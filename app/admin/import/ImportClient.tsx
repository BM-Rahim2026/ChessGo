"use client";
import { useActionState, useMemo, useState } from "react";
import { FIELDS, autoMap, normalizeRows, parseCsv, type Field, type Mapping } from "@/lib/importer";
import type { ImportSummary } from "@/lib/importRun";

type Result = { ok: true; summary: ImportSummary } | { ok: false; message: string } | null;

export function ImportClient({ action, groups }: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  groups: { id: string; name: string }[];
}) {
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
        <h2 className="h2">Import finished</h2>
        <ul className="text-sm">
          <li>✅ {s.created} students created, {s.parentsLinked} linked to a parent</li>
          {s.groupsCreated.length > 0 && <li>➕ New groups: {s.groupsCreated.join(", ")} (set their capacity, fee and schedule in Groups)</li>}
          {s.skipped > 0 && <li>↷ {s.skipped} skipped because they already exist</li>}
          {s.failed > 0 && <li>⚠ {s.failed} rows could not be imported</li>}
        </ul>
        {s.details.length > 0 && <details><summary className="cursor-pointer text-sm text-brand">Details</summary><ul className="muted mt-2 max-h-60 overflow-y-auto">{s.details.map((d, i) => <li key={i}>{d}</li>)}</ul></details>}
        <div className="flex gap-2"><a className="btn" href="/admin/students">View students</a><a className="btn-secondary" href="/admin/import">Import another file</a></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="h2 mb-2">1. Choose the file</h2>
        <p className="muted mb-3">A CSV export (from SportBM, Excel or Google Sheets) with one student per row. Comma or semicolon separated.</p>
        <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} className="text-sm" />
        {fileName && <p className="muted mt-2">{fileName}: {rows.length - 1} rows, {headers.length} columns</p>}
      </div>

      {headers.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">2. Check the columns</h2>
          <p className="muted mb-3">Detected automatically. Correct anything that&apos;s wrong. Use either first + last name columns or one full-name column.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(FIELDS) as Field[]).map((f) => (
              <label key={f} className="block">
                <span className="label">{FIELDS[f]}</span>
                <select className="input" value={mapping[f] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value === "" ? undefined : Number(e.target.value) }))}>
                  <option value="">— not in file —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="card">
          <h2 className="h2 mb-2">3. Preview</h2>
          <p className="mb-3 text-sm">
            {preview.length - errors} ready to import{errors > 0 && <span className="text-red-700"> · {errors} with errors (will be skipped)</span>}
            {warnings > 0 && <span className="text-amber-700"> · {warnings} with warnings</span>}
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="table">
              <thead><tr><th>Line</th><th>Student</th><th>Born</th><th>Group</th><th>Status</th><th>Parent</th><th>Email</th><th>Issues</th></tr></thead>
              <tbody>{preview.slice(0, 200).map((r) => (
                <tr key={r.line} className={r.errors.length ? "bg-red-50" : r.warnings.length ? "bg-amber-50" : ""}>
                  <td className="muted">{r.line}</td><td>{r.studentFirst} {r.studentLast}</td><td>{r.birthDate ?? "—"}</td><td>{r.group ?? "—"}</td>
                  <td>{r.active ? "active" : "inactive"}</td><td>{r.parentEmail ? `${r.parentFirst} ${r.parentLast}` : "—"}</td><td>{r.parentEmail ?? "—"}</td>
                  <td className="text-xs">{[...r.errors, ...r.warnings].join("; ")}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {preview.length > 200 && <p className="muted mt-2">Showing the first 200 rows.</p>}

          <form action={formAction} className="mt-5 space-y-3 border-t border-stone-100 pt-4">
            <input type="hidden" name="csv" value={csv} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            {newGroups.length > 0 && (
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="createGroups" defaultChecked className="mt-1" />
                <span>Create {newGroups.length} new group{newGroups.length > 1 ? "s" : ""}: {newGroups.join(", ")}</span></label>
            )}
            <label className="block max-w-sm"><span className="label">Group for students without one</span>
              <select className="input" name="defaultGroupId" defaultValue=""><option value="">No group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
            </label>
            {state && !state.ok && <p className="rounded bg-red-50 p-2 text-sm text-red-800">{state.message}</p>}
            <button className="btn" disabled={pending || preview.length - errors === 0}>{pending ? "Importing…" : `Import ${preview.length - errors} students`}</button>
          </form>
        </div>
      )}
    </div>
  );
}
