"use client";
import { useState } from "react";

/**
 * Extra correct solutions as a list of one-line fields: "+ Add" adds a field, ✕ removes one.
 * Sends them to the server as one hidden "altSolutions" value (one solution per line).
 */
export function AltSolutionsInput({ initial, labels }: {
  initial: string[];
  labels: { title: string; help: string; add: string; remove: string; item: string; placeholder: string };
}) {
  const [rows, setRows] = useState<string[]>(initial);
  const set = (i: number, v: string) => setRows((r) => r.map((x, j) => (j === i ? v : x)));
  return (
    <div className="sm:col-span-2">
      <input type="hidden" name="altSolutions" value={rows.map((r) => r.trim()).filter(Boolean).join("\n")} />
      <span className="label">{labels.title}</span>
      <p className="mb-2 text-xs text-ink-soft">{labels.help}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm font-semibold text-forest">{labels.item.replace("{n}", String(i + 2))}</span>
            <input className="input flex-1 font-mono" value={r} onChange={(e) => set(i, e.target.value)} placeholder={labels.placeholder}
              aria-label={labels.item.replace("{n}", String(i + 2))} autoFocus={i === rows.length - 1 && r === ""} />
            <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} title={labels.remove} aria-label={`${labels.remove} ${i + 2}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-ink/15 bg-white text-ink-soft hover:bg-red-50 hover:text-red-700">✕</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setRows((x) => [...x, ""])} className="btn-secondary btn-sm mt-2">+ {labels.add}</button>
    </div>
  );
}
