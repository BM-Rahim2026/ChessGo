import { Medal } from "./Brand";

/** Group leaderboard: first names only. Top three get brand medals with a number, not just a colour. */
export function Leaderboard({ rows, highlightId }: { rows: { id: string; name: string; xp: number; rank: number; badges: number }[]; highlightId?: string }) {
  if (!rows.length) return <p className="muted">No students yet.</p>;
  return (
    <ol className="divide-y divide-ink/10">
      {rows.map((r) => (
        <li key={r.id} className={`flex min-h-[48px] items-center gap-3 py-1.5 ${r.id === highlightId ? "rounded-control bg-mint px-2 font-semibold" : ""}`}>
          <span className="flex w-8 justify-center tabular-nums">
            {r.rank <= 3 ? <Medal place={r.rank as 1 | 2 | 3} size={22} /> : <span className="text-ink-soft">{r.rank}</span>}
          </span>
          <span className="flex-1">{r.name}{r.id === highlightId && <span className="sr-only"> (you)</span>}</span>
          <span className="muted text-xs">{r.badges} badge{r.badges === 1 ? "" : "s"}</span>
          <span className="w-20 text-right tabular-nums">{r.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}
