// ChessGo brand elements (Brand guidelines v1.1).
import { getT } from "@/lib/i18n/server";
// The wordmark is original raster artwork: never recreate it with a font, recolor, stretch or add effects.

/** Primary wordmark. Min width 180px; on dark surfaces it sits on a light holding panel. */
export function Logo({ width = 180, onDark = false, className = "" }: { width?: number; onDark?: boolean; className?: string }) {
  const w = Math.max(180, width);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/chessgo-logo.png" alt="ChessGo" width={w} height={Math.round((w * 201) / 720)} className="block h-auto select-none" />
  );
  // Clear space: x = 25% of the logo height on all sides.
  const pad = Math.round(((w * 201) / 720) * 0.25);
  return <span className={`inline-block ${onDark ? "rounded-control bg-cream" : ""} ${className}`} style={{ padding: pad }}>{img}</span>;
}

/** Compact Crown-C mark for icons and avatars (min 32px tall). */
export function CrownC({ size = 32, className = "" }: { size?: number; className?: string }) {
  const h = Math.max(32, size);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/crown-c.png" alt="ChessGo" height={h} width={Math.round((h * 256) / 369)} className={`inline-block h-auto ${className}`} style={{ height: h, width: "auto" }} />;
}

const MEDALS = {
  1: { color: "#B8860B", label: "Gold" },
  2: { color: "#7A8B99", label: "Silver" },
  3: { color: "#A65A2E", label: "Bronze" },
  0: { color: "#0B3D2E", label: "Participation" },
} as const;

/** Medal with forest/green ribbon. place 1–3, or 0 for participation. */
export function Medal({ place, size = 32, label }: { place: 0 | 1 | 2 | 3; size?: number; label?: string }) {
  const m = MEDALS[place];
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" role="img" aria-label={label ?? `${m.label} medal`}>
      <path d="M11 0h9l-4 16h-9z" fill="#0B3D2E" />
      <path d="M20 0h9l-4 16h-9z" fill="#59D706" />
      <circle cx="20" cy="32" r="14" fill="#FAF8EF" stroke={m.color} strokeWidth="5" />
      <text x="20" y="37.5" textAnchor="middle" fontFamily="Readex Pro, sans-serif" fontWeight="700" fontSize="14" fill={place ? m.color : "#0B3D2E"}>
        {place || "+"}
      </text>
    </svg>
  );
}

/** Leagues differ in name, colour AND shape (never colour alone). */
export const LEAGUES = [
  { key: "discovery", name: "Discovery", from: 1, color: "#59D706" },
  { key: "progress", name: "Progress", from: 4, color: "#2366A8" },
  { key: "strategy", name: "Strategy", from: 7, color: "#7E57C2" },
  { key: "mastery", name: "Mastery", from: 10, color: "#B8860B" },
] as const;

export function leagueFor(level: number) {
  return [...LEAGUES].reverse().find((l) => level >= l.from)!;
}

export async function LeagueBadge({ level, size = 20 }: { level: number; size?: number }) {
  const t = await getT();
  const l = leagueFor(level);
  const shape =
    l.key === "discovery" ? <circle cx="12" cy="12" r="10" fill={l.color} /> :
    l.key === "progress" ? <rect x="2" y="2" width="20" height="20" rx="5" fill={l.color} /> :
    l.key === "strategy" ? <path d="M12 1l11 11-11 11L1 12z" fill={l.color} /> :
    <path d="M2 20h20l-1.5-12-5 4L12 3 8.5 12l-5-4z" fill={l.color} />;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{shape}</svg>
      {t(`${l.name} league`)}
    </span>
  );
}

/** Move Trail: records daily practice without flame imagery. A missed day is simply an empty step. */
export async function MoveTrail({ days, size = 22 }: { days: { day: string; done: boolean; today: boolean }[]; size?: number }) {
  const t = await getT();
  const done = days.filter((d) => d.done).length;
  return (
    <div role="img" aria-label={t("Move Trail: daily puzzle solved on {done} of the last {n} days", { done, n: days.length })} className="flex items-center">
      {days.map((d, i) => (
        <div key={d.day} className="flex items-center">
          {i > 0 && <span className={`h-[3px] w-4 sm:w-6 ${d.done && days[i - 1].done ? "bg-forest/60" : "bg-mint"}`} />}
          <span title={d.day} className="inline-flex items-center justify-center rounded-full"
            style={{ width: size, height: size, background: d.done ? "#FDDA05" : "#fff", border: `2px solid ${d.done ? "#0B3D2E" : d.today ? "#0B3D2E" : "#C9D8CC"}` }}>
            {d.done && <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" aria-hidden><path d="M2 6.5l2.5 2.5L10 3.5" stroke="#0B3D2E" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Feedback box (Quiet Mint) with a check or info shape, not colour alone. */
export function Feedback({ kind = "success", title, children }: { kind?: "success" | "try" | "info"; title: string; children?: React.ReactNode }) {
  const icon = kind === "success" ? "M4 12.5l5 5L20 6.5" : kind === "try" ? "M12 7v6M12 17h.01" : "M12 8h.01M12 11v6";
  return (
    <div role="status" className={`flex gap-3 rounded-learner p-4 ${kind === "try" ? "bg-[#FFF8D6]" : "bg-mint"}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="mt-0.5 shrink-0"><path d={icon} stroke="#0B3D2E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div><div className="font-display text-lg font-semibold text-forest">{title}</div>{children && <div className="text-ink">{children}</div>}</div>
    </div>
  );
}
