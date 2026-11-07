"use client";
import { useEffect, useRef, useState } from "react";

// Landing-page board that plays a short sequence on a loop (Club Classic colours #F4F1E5 / #648273).
// Pieces are an absolutely positioned layer, so a move is just a CSS transform transition.
// Respects prefers-reduced-motion (static start position) and pauses when off-screen or the tab is hidden.

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
type Piece = { id: string; type: string; sq: string; gone?: boolean };
export type DemoMove = { from: string; to: string; label: string };

const file = (sq: string) => sq.charCodeAt(0) - 97; // a → 0
const rank = (sq: string) => Number(sq[1]); // 1..8

function parse(fen: string): Piece[] {
  const out: Piece[] = [];
  fen.split(" ")[0].split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else { const sq = String.fromCharCode(97 + f) + (8 - r); out.push({ id: `${ch}${sq}`, type: ch, sq }); f++; }
    }
  });
  return out;
}

export function AnimatedBoard({ fen, moves, size = 264, caption, mateLabel, ariaLabel }: {
  fen: string; moves: DemoMove[]; size?: number; caption: string; mateLabel: string; ariaLabel: string;
}) {
  const start = useRef(parse(fen));
  const [pieces, setPieces] = useState<Piece[]>(start.current);
  const [ply, setPly] = useState(0); // moves played so far
  const [fade, setFade] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = true;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (box.current) io.observe(box.current);

    const tick = () => {
      if (!visible || document.hidden) { timer = setTimeout(tick, 800); return; }
      if (step < moves.length) {
        const m = moves[step];
        setPieces((ps) => ps.map((p) => (p.sq === m.to && !p.gone ? { ...p, gone: true } : p.sq === m.from && !p.gone ? { ...p, sq: m.to } : p)));
        step++;
        setPly(step);
        timer = setTimeout(tick, step === moves.length ? 3200 : 1500);
      } else {
        setFade(true); // fade out, reset, fade in
        timer = setTimeout(() => {
          setPieces(start.current); setPly(0); step = 0;
          setTimeout(() => setFade(false), 60);
          timer = setTimeout(tick, 1800);
        }, 450);
      }
    };
    timer = setTimeout(tick, 1400);
    return () => { clearTimeout(timer); io.disconnect(); };
  }, [moves]);

  const last = ply > 0 ? moves[ply - 1] : null;
  const done = ply === moves.length;
  const cell = `min(${size / 8}px, calc((100vw - 88px) / 8))`;
  const pos = (sq: string) => `translate(calc(var(--cell) * ${file(sq)}), calc(var(--cell) * ${8 - rank(sq)}))`;

  return (
    <div ref={box} style={{ ["--cell" as string]: cell }} role="img" aria-label={ariaLabel}>
      <div className="flex">
        <div className="grid w-4 text-xs text-ink-soft" style={{ gridTemplateRows: "repeat(8, var(--cell))" }}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((n) => <span key={n} className="flex items-center">{n}</span>)}
        </div>
        <div className="relative overflow-hidden rounded-md" style={{ width: "calc(var(--cell) * 8)", height: "calc(var(--cell) * 8)" }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(8, var(--cell))", gridTemplateRows: "repeat(8, var(--cell))" }}>
            {Array.from({ length: 64 }, (_, i) => {
              const r = Math.floor(i / 8), c = i % 8;
              const sq = String.fromCharCode(97 + c) + (8 - r);
              const hl = last && (sq === last.from || sq === last.to);
              return (
                <div key={sq} style={{ background: (r + c) % 2 ? "#648273" : "#F4F1E5" }}>
                  {hl && <div className="h-full w-full" style={{ background: "rgba(253, 218, 5, 0.55)" }} />}
                </div>
              );
            })}
          </div>
          <div className={`absolute inset-0 transition-opacity duration-500 ${fade ? "opacity-0" : "opacity-100"}`}>
            {pieces.map((p) => {
              const white = p.type === p.type.toUpperCase();
              const matedKing = done && p.type === "k";
              return (
                <span key={p.id} aria-hidden
                  className="absolute left-0 top-0 flex items-center justify-center"
                  style={{
                    width: "var(--cell)", height: "var(--cell)", transform: pos(p.sq),
                    transition: "transform 700ms cubic-bezier(.45,.05,.25,1), opacity 300ms",
                    opacity: p.gone ? 0 : 1, fontSize: "calc(var(--cell) * 0.74)", lineHeight: 1,
                  }}>
                  <span className={matedKing ? "cg-mated" : ""} style={white
                    ? { color: "#FFFFFF", WebkitTextStroke: "calc(var(--cell) / 18) #0B3D2E", paintOrder: "stroke fill" }
                    : { color: "#0B3D2E" }}>
                    {GLYPH[p.type.toLowerCase()]}
                  </span>
                </span>
              );
            })}
          </div>
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-500 ${done && !fade ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}>
            <span className="rounded-full bg-go px-4 py-1.5 font-display text-lg font-bold text-forest shadow-lg">{mateLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex text-xs text-ink-soft">
        <span className="w-4" />
        {"abcdefgh".split("").map((f) => <span key={f} className="text-center" style={{ width: "var(--cell)" }}>{f}</span>)}
      </div>
      <p className="muted mt-1 min-h-[1.5em] text-sm" aria-live="off">
        {ply === 0 ? caption : moves.slice(0, ply).map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m.label}` : m.label)).join(" ")}
      </p>
    </div>
  );
}
