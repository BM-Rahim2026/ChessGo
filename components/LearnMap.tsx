"use client";
import { useEffect, useState } from "react";
import { readLocalProgress } from "./LearnBoard";

type MapChapter = { id: string; icon: string; title: string; intro: string; levels: { id: string; n: number }[] };

/** Course map: chapters with their levels and stars. Students' stars come from the server, visitors' from this browser. */
export function LearnMap({ chapters, serverProgress, labels }: {
  chapters: MapChapter[]; serverProgress: Record<string, number> | null; labels: { levels: string; start: string; continue: string; total: string };
}) {
  const [progress, setProgress] = useState<Record<string, number>>(serverProgress ?? {});
  useEffect(() => { if (!serverProgress) setProgress(readLocalProgress()); }, [serverProgress]);
  const all = chapters.flatMap((c) => c.levels);
  const earned = all.reduce((a, l) => a + (progress[l.id] ?? 0), 0);
  const firstOpen = all.find((l) => !progress[l.id]);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="pill pill-green">★ {labels.total.replace("{n}", String(earned)).replace("{max}", String(all.length * 3))}</span>
        {firstOpen && <a href={`/nauka/${firstOpen.id}`} className="btn">{earned ? labels.continue : labels.start}</a>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {chapters.map((c) => {
          const done = c.levels.filter((l) => progress[l.id]).length;
          return (
            <div key={c.id} className="card-learner flex flex-col">
              <div className="flex items-center gap-3">
                <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-3xl text-forest">{c.icon}</span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold text-forest">{c.title}</h2>
                  <p className="text-xs text-ink-soft">{labels.levels.replace("{n}", String(done)).replace("{max}", String(c.levels.length))}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink">{c.intro}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {c.levels.map((l) => {
                  const s = progress[l.id] ?? 0;
                  return (
                    <a key={l.id} href={`/nauka/${l.id}`} aria-label={`${c.title} ${l.n}: ${s}/3`}
                      className={`flex min-h-[48px] min-w-[48px] flex-col items-center justify-center rounded-control border px-2 text-sm font-semibold ${s ? "border-chess bg-mint text-forest" : "border-ink/15 bg-white text-ink hover:bg-mint"}`}>
                      {l.n}
                      <span className="text-[10px] leading-none" aria-hidden>{[1, 2, 3].map((i) => <span key={i} style={{ color: i <= s ? "#E8B800" : "#D1D5DB" }}>★</span>)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
