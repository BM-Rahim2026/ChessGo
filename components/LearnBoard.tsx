"use client";
import { useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  applyBoardMove, bestMoves, boardDone, boardMoves, chessMoveResult, startBoard, starsFor,
  type BoardState, type Level,
} from "@/lib/learn/engine";
import { saveLearnLevel } from "@/app/actions/learn";

// One "Nauka" level: board levels (collect stars / capture) or chess levels (check, mate, castling…).

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";
const STORE = "cg_learn_progress";

export type LearnLabels = {
  moves: string; best: string; wrong: string; done: string; again: string; next: string; map: string;
  savedXp: string; savedLocal: string; finishedAll: string; illegal: string;
};

function saveLocal(levelId: string, stars: number) {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || "{}") as Record<string, number>;
    p[levelId] = Math.max(p[levelId] ?? 0, stars);
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch { /* private mode: progress just isn't remembered */ }
}

export function LearnBoard({ level, labels, nextHref, mapHref, isStudent }: {
  level: Level; labels: LearnLabels; nextHref: string | null; mapHref: string; isStudent: boolean;
}) {
  const isBoard = level.goal === "collect" || level.goal === "capture";
  const best = useMemo(() => (isBoard ? bestMoves(level) : 1), [level, isBoard]);
  const [st, setSt] = useState<BoardState>(() => startBoard(level));
  const [game, setGame] = useState(() => new Chess(level.fen ?? "4k3/8/8/8/8/8/8/4K3 w - - 0 1"));
  const [moves, setMoves] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ stars: number; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dragFrom = useRef<string | null>(null);

  // Board contents in a common shape.
  const pieceAt = (s: string): { type: string; white: boolean } | null => {
    if (isBoard) return st.board.get(s) ?? null;
    const p = game.get(s as Square);
    return p ? { type: p.type, white: p.color === "w" } : null;
  };
  const targets = useMemo(() => {
    if (!sel) return new Set<string>();
    if (isBoard) return new Set(boardMoves(st.board, sel));
    return new Set(game.moves({ square: sel as Square, verbose: true }).map((m) => m.to));
  }, [sel, st, game, isBoard]);

  const reset = () => {
    setSt(startBoard(level)); setGame(new Chess(level.fen ?? "4k3/8/8/8/8/8/8/4K3 w - - 0 1"));
    setMoves([]); setSel(null); setLast(null); setBad(null); setMsg(null); setResult(null); setBusy(false);
  };

  async function finish(all: string[], localStars: number) {
    setBusy(true);
    let note = "";
    let stars = localStars;
    try {
      const r = await saveLearnLevel(level.id, all);
      if (r.stars) stars = r.stars;
      if (r.saved) note = r.gained > 0 ? labels.savedXp.replace("{n}", String(r.gained)) : "";
      else { saveLocal(level.id, stars); note = isStudent ? "" : labels.savedLocal; }
    } catch {
      saveLocal(level.id, stars);
    }
    setResult({ stars, note });
    setBusy(false);
  }

  function move(from: string, to: string) {
    if (busy || result) return;
    const legal = isBoard ? boardMoves(st.board, from) : game.moves({ square: from as Square, verbose: true }).map((m) => m.to);
    if (!legal.includes(to)) { setSel(null); return; }
    const uci = from + to;
    setSel(null);
    if (isBoard) {
      const n = applyBoardMove(st, from, to);
      const all = [...moves, uci];
      setSt(n); setMoves(all); setLast([from, to]); setMsg(null);
      if (boardDone(level, n)) finish(all, starsFor(all.length, best));
      return;
    }
    const r = chessMoveResult(level, uci);
    if (!r.legal) { setMsg(labels.illegal); return; }
    const all = [...moves, uci];
    setMoves(all);
    const n = new Chess(game.fen());
    n.move({ from, to, promotion: "q" });
    setGame(n); setLast([from, to]);
    if (r.done) { setMsg(null); finish(all, all.length === 1 ? 3 : all.length <= 3 ? 2 : 1); return; }
    setBad(to); setMsg(labels.wrong); setBusy(true);
    setTimeout(() => { setGame(new Chess(level.fen)); setLast(null); setBad(null); setBusy(false); }, 900);
  }

  const onSquare = (s: string) => {
    if (busy || result) return;
    if (sel && targets.has(s)) { move(sel, s); return; }
    const p = pieceAt(s);
    if (p && p.white) setSel(s === sel ? null : s);
    else setSel(null);
  };

  const cell = `min(52px, calc((100vw - 72px) / 8))`;
  const stars = isBoard ? st.stars : new Set<string>();

  return (
    <div className="min-w-0" style={{ ["--cell" as string]: cell }}>
      <div className="flex">
        <div className="grid w-4 text-xs text-ink-soft" style={{ gridTemplateRows: "repeat(8, var(--cell))" }}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((r) => <span key={r} className="flex items-center">{r}</span>)}
        </div>
        <div className={`relative grid touch-none select-none overflow-hidden rounded-md ${bad ? "cg-shake" : ""}`}
          style={{ gridTemplateColumns: "repeat(8, var(--cell))", gridTemplateRows: "repeat(8, var(--cell))" }}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((r, ri) => [...FILES].map((f, fi) => {
            const s = `${f}${r}`;
            const p = pieceAt(s);
            const dark = (ri + fi) % 2 === 1;
            const isLast = last && (last[0] === s || last[1] === s);
            const hl = bad === s ? "rgba(220,38,38,.55)" : sel === s ? "rgba(89,215,6,.55)" : isLast ? "rgba(253,218,5,.45)" : null;
            return (
              <button key={s} type="button" aria-label={`${s}${p ? ` ${p.white ? "white" : "black"} ${p.type}` : ""}${stars.has(s) ? " star" : ""}`}
                onClick={() => onSquare(s)}
                onDragOver={(e) => { if (dragFrom.current) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); const from = dragFrom.current; dragFrom.current = null; if (from && from !== s) { setSel(from); move(from, s); } }}
                className="relative flex items-center justify-center p-0" style={{ background: dark ? "#648273" : "#F4F1E5" }}>
                {hl && <span className="absolute inset-0" style={{ background: hl }} />}
                {stars.has(s) && !p && <span aria-hidden className="cg-star relative leading-none" style={{ fontSize: "calc(var(--cell) * 0.62)", color: "#FDDA05", WebkitTextStroke: "1.5px #0B3D2E" }}>★</span>}
                {targets.has(s) && (
                  <span className="absolute rounded-full" style={p
                    ? { inset: "6%", border: "calc(var(--cell) / 14) solid rgba(11,61,46,.45)" }
                    : { width: "28%", height: "28%", background: "rgba(11,61,46,.4)" }} />
                )}
                {p && (
                  <span draggable={!busy && !result && p.white}
                    onDragStart={() => { dragFrom.current = s; setSel(s); }}
                    className={`relative cursor-pointer leading-none ${result && !p.white && p.type === "k" && level.goal === "mate" ? "cg-mated" : ""}`}
                    style={{ fontSize: "calc(var(--cell) * 0.78)", ...(p.white
                      ? { color: "#FFFFFF", WebkitTextStroke: "calc(var(--cell) / 18) #0B3D2E", paintOrder: "stroke fill" }
                      : { color: "#0B3D2E" }) }}>
                    {GLYPH[p.type]}
                  </span>
                )}
              </button>
            );
          }))}
          {result && (
            <div className="absolute inset-0 flex items-center justify-center bg-forest/55 p-3">
              <div className="w-full max-w-[260px] rounded-learner bg-white p-4 text-center shadow-xl">
                <div className="text-4xl tracking-wider" aria-label={`${result.stars}/3`}>
                  {[1, 2, 3].map((i) => <span key={i} style={{ color: i <= result.stars ? "#FDDA05" : "#E5E7EB", WebkitTextStroke: "1.5px #0B3D2E" }}>★</span>)}
                </div>
                <p className="mt-2 font-display text-lg font-semibold text-forest">{labels.done}</p>
                {result.note && <p className="mt-1 text-sm text-ink">{result.note}</p>}
                <div className="mt-3 flex flex-col gap-2">
                  {nextHref ? <a href={nextHref} className="btn">{labels.next}</a> : <p className="text-sm font-semibold text-forest">{labels.finishedAll}</p>}
                  <button type="button" className="btn-secondary btn-sm" onClick={reset}>{labels.again}</button>
                  <a href={mapHref} className="text-sm text-forest underline">{labels.map}</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex text-xs text-ink-soft">
        <span className="w-4" />
        {[...FILES].map((f) => <span key={f} className="text-center" style={{ width: "var(--cell)" }}>{f}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3" style={{ maxWidth: "calc(var(--cell) * 8 + 16px)" }}>
        {isBoard && <span className="pill">{labels.moves}: {moves.length}</span>}
        {isBoard && best > 0 && <span className="pill pill-green">{labels.best}: {best}</span>}
        <button type="button" className="btn-secondary btn-sm ml-auto" onClick={reset} disabled={busy}>{labels.again}</button>
      </div>
      {msg && <p role="status" className="mt-2 rounded-control bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{msg}</p>}
    </div>
  );
}

/** Read the browser-saved progress (for visitors without a student account). */
export function readLocalProgress(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}
