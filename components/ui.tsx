import Link from "next/link";
import { getT } from "@/lib/i18n/server";

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
      <div className="font-display text-2xl font-semibold text-forest">{value}</div>
      {hint && <div className="muted mt-1">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-card border border-dashed border-ink/25 p-6 text-center text-sm text-ink-soft">{children}</div>;
}

const tones: Record<string, string> = {
  active: "pill-green", paid: "pill-green", present: "pill-green", converted: "pill-green", collected: "pill-green", ready: "pill-blue",
  new: "pill-blue", trial: "pill-blue", open: "pill-blue", late: "pill-amber", pending: "pill-amber", contacted: "pill-amber", unpaid: "pill-amber",
  past_due: "pill-red", overdue: "pill-red", absent: "pill-red", cancelled: "pill-red", suspended: "pill-red", inactive: "", archived: "",
};
/** Status pill. Status keys (e.g. "past_due") are translated; custom children are shown as given. */
export async function Pill({ v, children }: { v: string; children?: React.ReactNode }) {
  const t = await getT();
  return <span className={`pill ${tones[v] ?? ""}`}>{children ?? t(`status:${v}`).replace(/^status:/, "").replace(/_/g, " ")}</span>;
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-ink/15">
      {items.map((i) => (
        <Link key={i.key} href={i.href}
          className={`-mb-px flex min-h-[40px] items-center border-b-2 px-3 text-sm ${i.key === active ? "border-forest font-semibold text-forest" : "border-transparent text-ink-soft hover:text-forest"}`}>
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
          <span className="truncate text-ink-soft">{String(r[label])}</span>
          <div className="h-4 rounded-control bg-mint">
            <div className="h-4 rounded-control bg-forest" style={{ width: `${Math.min(100, (vals[i] / top) * 100)}%` }} />
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
