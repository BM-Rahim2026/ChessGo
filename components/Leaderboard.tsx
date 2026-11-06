export function Leaderboard({ rows, highlightId }: { rows: { id: string; name: string; xp: number; rank: number; badges: number }[]; highlightId?: string }) {
  if (!rows.length) return <p className="muted">No students yet.</p>;
  const medal = (r: number) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r);
  return (
    <ol className="divide-y divide-stone-100">
      {rows.map((r) => (
        <li key={r.id} className={`flex items-center gap-3 py-2 ${r.id === highlightId ? "rounded bg-brand-light px-2 font-semibold" : ""}`}>
          <span className="w-8 text-center tabular-nums">{medal(r.rank)}</span>
          <span className="flex-1">{r.name}</span>
          <span className="muted text-xs">{r.badges} 🏅</span>
          <span className="w-16 text-right tabular-nums">{r.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}
