import { Medal } from "./Brand";
import { getLocale } from "@/lib/i18n/server";
import { makeT, plural } from "@/lib/i18n/core";

/** Group ranking: first names only. Top three get brand medals with a number, not just a colour. */
export async function Leaderboard({ rows, highlightId }: { rows: { id: string; name: string; xp: number; rank: number; badges: number }[]; highlightId?: string }) {
  const locale = await getLocale();
  const t = makeT(locale);
  if (!rows.length) return <p className="muted">{t("No students yet.")}</p>;
  return (
    <ol className="divide-y divide-ink/10">
      {rows.map((r) => (
        <li key={r.id} className={`flex min-h-[48px] items-center gap-3 py-1.5 ${r.id === highlightId ? "rounded-control bg-mint px-2 font-semibold" : ""}`}>
          <span className="flex w-8 justify-center tabular-nums">
            {r.rank <= 3 ? <Medal place={r.rank as 1 | 2 | 3} size={22} label={t(["", "Gold", "Silver", "Bronze"][r.rank]) + " " + t("medal")} /> : <span className="text-ink-soft">{r.rank}</span>}
          </span>
          <span className="flex-1">{r.name}{r.id === highlightId && <span className="sr-only"> ({t("you")})</span>}</span>
          <span className="muted text-xs">{r.badges} {plural(locale, r.badges, t("badge"), t("badges"), t("badges_many"))}</span>
          <span className="w-20 text-right tabular-nums">{r.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}
