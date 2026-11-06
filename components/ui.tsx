import Link from "next/link";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {sub && <p className="muted mt-1">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="muted mt-1">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</div>;
}

const tones: Record<string, string> = {
  active: "pill-green", paid: "pill-green", present: "pill-green", converted: "pill-green", collected: "pill-green", ready: "pill-blue",
  new: "pill-blue", trial: "pill-blue", open: "pill-blue", late: "pill-amber", pending: "pill-amber", contacted: "pill-amber", unpaid: "pill-amber",
  past_due: "pill-red", overdue: "pill-red", absent: "pill-red", cancelled: "pill-red", suspended: "pill-red", inactive: "", archived: "",
};
export function Pill({ v, children }: { v: string; children?: React.ReactNode }) {
  return <span className={`pill ${tones[v] ?? ""}`}>{children ?? v.replace(/_/g, " ")}</span>;
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-stone-200">
      {items.map((i) => (
        <Link key={i.key} href={i.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${i.key === active ? "border-brand font-medium text-brand" : "border-transparent text-stone-500 hover:text-stone-800"}`}>
          {i.label}
        </Link>
      ))}
    </div>
  );
}

/** Minimal horizontal bar chart, no JS. */
export function Bars({ rows, value, label, format = (n) => String(n), max }: {
  rows: Record<string, unknown>[]; value: string; label: string; format?: (n: number) => string; max?: number;
}) {
  const vals = rows.map((r) => Number(r[value]) || 0);
  const top = max ?? Math.max(1, ...vals);
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[5.5rem_1fr_5rem] items-center gap-2 text-sm">
          <span className="truncate text-stone-500">{String(r[label])}</span>
          <div className="h-4 rounded bg-stone-100">
            <div className="h-4 rounded bg-brand" style={{ width: `${Math.min(100, (vals[i] / top) * 100)}%` }} />
          </div>
          <span className="text-right tabular-nums">{format(vals[i])}</span>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
