"use client";
import { useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import type { MoveResponse } from "@/app/actions/puzzle";

// Interactive puzzle board (Club Classic colours). Click a piece, then a highlighted square
// (or drag it). Each move is checked on the server; the opponent's reply plays automatically.

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";

export type PuzzleLabels = {
  yourMove: string; whiteToMove: string; blackToMove: string; correct: string; wrong: string;
  solved: string; solvedByMate: string; xp: string; already: string; retry: string; reset: string; hint: string;
  showSolution: string; testMode: string; error: string; promote: string;
};

type Props = {
  puzzleId: string;
  fen: string;
  hint?: string | null;
  labels: PuzzleLabels;
  size?: number;
  check: (puzzleId: string, moves: string[]) => Promise<MoveResponse>;
  solution?: () => Promise<string[]>; // admin test mode only
  solvedAlready?: boolean;
};

type Flash = { kind: "ok" | "bad" | "done" | "info"; text: string } | null;

export function PuzzleBoard({ puzzleId, fen, hint, labels, size = 360, check, solution, solvedAlready }: Props) {
  const startColor = new Chess(fen).turn();
  const [game, setGame] = useState(() => new Chess(fen));
  const [moves, setMoves] = useState<string[]>([]);
  const [sel, setSel] = useState<Square | null>(null);
  const [last, setLast] = useState<[string, string] | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [flash, setFlash] = useState<Flash>(solvedAlready ? { kind: "info", text: labels.already } : null);
  const [showHint, setShowHint] = useState(false);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const dragFrom = useRef<Square | null>(null);
  const flipped = startColor === "b";

  const board = game.board(); // [rank8..rank1][a..h]
  const targets = useMemo(() => (sel ? new Set(game.moves({ square: sel, verbose: true }).map((m) => m.to)) : new Set<string>()), [sel, game]);
  const checkSq = useMemo(() => {
    if (!game.inCheck()) return null;
    for (const row of board) for (const p of row) if (p && p.type === "k" && p.color === game.turn()) return p.square;
    return null;
  }, [game, board]);

  const apply = (g: Chess, uci: string) => {
    const n = new Chess(g.fen());
    n.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return n;
  };

  const reset = () => {
    setGame(new Chess(fen)); setMoves([]); setSel(null); setLast(null); setBad(null); setDone(false); setPromo(null);
    setFlash(null);
  };

  async function play(from: Square, to: Square, promotion?: string) {
    if (busy || done) return;
    const legal = game.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!legal) return;
    if (legal.isPromotion() && !promotion) { setPromo({ from, to }); return; }
    const uci = from + to + (promotion ?? "");
    const before = game;
    const after = apply(game, uci);
    setGame(after); setSel(null); setLast([from, to]); setBad(null); setBusy(true);
    const seq = [...moves, uci];
    let res: MoveResponse;
    try {
      res = await check(puzzleId, seq);
    } catch {
      res = { status: "error" };
    }
    if (res.status === "wrong") {
      setBad(to); setFlash({ kind: "bad", text: labels.wrong });
      setTimeout(() => { setGame(before); setLast(null); setBad(null); setBusy(false); }, 900);
      return;
    }
    if (res.status === "error") {
      setFlash({ kind: "bad", text: labels.error });
      setTimeout(() => { setGame(before); setLast(null); setBusy(false); }, 900);
      return;
    }
    if (res.status === "correct") {
      const r = res.replyUci;
      setFlash({ kind: "ok", text: labels.correct });
      setTimeout(() => {
        setGame(apply(after, r)); setLast([r.slice(0, 2), r.slice(2, 4)]);
        setMoves([...seq, r]); setBusy(false);
        setFlash({ kind: "info", text: labels.yourMove });
      }, 550);
      return;
    }
    // solved
    if (res.replyUci) {
      const r = res.replyUci;
      setTimeout(() => { setGame(apply(after, r)); setLast([r.slice(0, 2), r.slice(2, 4)]); }, 550);
    }
    setMoves(seq); setDone(true); setBusy(false);
    const xp = res.gained ? ` +${res.gained} ${labels.xp}` : "";
    setFlash({ kind: "done", text: (res.byMate ? labels.solvedByMate : labels.solved) + xp });
  }

  async function replaySolution() {
    if (!solution || busy) return;
    reset();
    setBusy(true);
    const line = await solution();
    let g = new Chess(fen);
    for (const [i, uci] of line.entries()) {
      await new Promise((r) => setTimeout(r, i === 0 ? 300 : 800));
      g = apply(g, uci);
      setGame(g); setLast([uci.slice(0, 2), uci.slice(2, 4)]);
    }
    setFlash({ kind: "info", text: labels.showSolution + ": ✓" });
    setBusy(false);
  }

  const onSquare = (sq: Square) => {
    if (busy || done) return;
    const p = game.get(sq);
    if (sel && targets.has(sq)) { play(sel, sq); return; }
    if (p && p.color === game.turn()) setSel(sq === sel ? null : sq);
    else setSel(null);
  };

  const cell = `min(${size / 8}px, calc((100vw - 120px) / 8))`;
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? [...FILES].reverse() : [...FILES];
  const toMove = game.turn() === "w" ? labels.whiteToMove : labels.blackToMove;

  return (
    <div className="min-w-0" style={{ ["--cell" as string]: cell }}>
      <div className="flex">
        <div className="grid w-4 text-xs text-ink-soft" style={{ gridTemplateRows: "repeat(8, var(--cell))" }}>
          {ranks.map((r) => <span key={r} className="flex items-center">{r}</span>)}
        </div>
        <div className={`relative grid touch-none select-none overflow-hidden rounded-md ${bad ? "cg-shake" : ""}`}
          style={{ gridTemplateColumns: "repeat(8, var(--cell))", gridTemplateRows: "repeat(8, var(--cell))" }}>
          {ranks.map((r, ri) => files.map((f, fi) => {
            const sq = `${f}${r}` as Square;
            const p = board[8 - r][FILES.indexOf(f)];
            const dark = (ri + fi) % 2 === 1;
            const isLast = last && (last[0] === sq || last[1] === sq);
            const bg = bad === sq ? "rgba(220,38,38,.55)" : sel === sq ? "rgba(89,215,6,.55)" : isLast ? "rgba(253,218,5,.55)" : checkSq === sq ? "rgba(220,38,38,.35)" : null;
            const white = p?.color === "w";
            return (
              <button key={sq} type="button" aria-label={`${sq}${p ? ` ${p.color === "w" ? "white" : "black"} ${p.type}` : ""}`}
                onClick={() => onSquare(sq)}
                onDragOver={(e) => { if (dragFrom.current) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); const from = dragFrom.current; dragFrom.current = null; if (from && from !== sq) play(from, sq); }}
                className="relative flex items-center justify-center p-0 outline-offset-[-3px]"
                style={{ background: dark ? "#648273" : "#F4F1E5" }}>
                {bg && <span className="absolute inset-0" style={{ background: bg }} />}
                {targets.has(sq) && (
                  <span className="absolute rounded-full" style={p
                    ? { inset: "6%", border: "calc(var(--cell) / 14) solid rgba(11,61,46,.45)" }
                    : { width: "28%", height: "28%", background: "rgba(11,61,46,.4)" }} />
                )}
                {p && (
                  <span draggable={!busy && !done && p.color === game.turn()}
                    onDragStart={() => { dragFrom.current = sq; setSel(sq); }}
                    className={`relative cursor-pointer leading-none ${done && p.type === "k" && p.color === game.turn() && game.isCheckmate() ? "cg-mated" : ""}`}
                    style={{ fontSize: "calc(var(--cell) * 0.78)", ...(white
                      ? { color: "#FFFFFF", WebkitTextStroke: "calc(var(--cell) / 18) #0B3D2E", paintOrder: "stroke fill" }
                      : { color: "#0B3D2E" }) }}>
                    {GLYPH[p.type]}
                  </span>
                )}
              </button>
            );
          }))}
          {promo && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <div className="rounded-card bg-white p-3 shadow-lg">
                <p className="mb-2 text-center text-sm font-semibold text-forest">{labels.promote}</p>
                <div className="flex gap-2">
                  {(["q", "r", "b", "n"] as const).map((k) => (
                    <button key={k} type="button" className="h-12 w-12 rounded-control border border-ink/15 text-3xl hover:bg-mint"
                      onClick={() => { const pr = promo; setPromo(null); play(pr.from, pr.to, k); }}>
                      <span style={game.turn() === "w" ? { color: "#fff", WebkitTextStroke: "2px #0B3D2E", paintOrder: "stroke fill" } : { color: "#0B3D2E" }}>{GLYPH[k]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex text-xs text-ink-soft">
        <span className="w-4" />
        {files.map((f) => <span key={f} className="text-center" style={{ width: "var(--cell)" }}>{f}</span>)}
      </div>

      <div className="mt-3 space-y-2" style={{ maxWidth: `calc(var(--cell) * 8 + 16px)` }}>
        <div role="status" aria-live="polite"
          className={`min-h-[48px] rounded-control px-3 py-2 text-[15px] font-semibold ${
            flash?.kind === "bad" ? "bg-red-50 text-red-800" : flash?.kind === "done" ? "bg-go text-forest" : flash?.kind === "ok" ? "bg-mint text-forest" : "bg-mint/60 text-forest"}`}>
          {flash ? flash.text : `${toMove}. ${labels.yourMove}`}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={reset} disabled={busy}>{done ? labels.retry : labels.reset}</button>
          {hint && <button type="button" className="btn-secondary btn-sm" onClick={() => setShowHint((v) => !v)}>{labels.hint}</button>}
          {solution && <button type="button" className="btn-secondary btn-sm" onClick={replaySolution} disabled={busy}>{labels.showSolution}</button>}
        </div>
        {showHint && hint && <p className="rounded-control bg-white px-3 py-2 text-sm text-ink">💡 {hint}</p>}
        {solution && <p className="text-xs text-ink-soft">{labels.testMode}</p>}
      </div>
    </div>
  );
}
