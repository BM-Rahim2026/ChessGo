// Club Classic board (#F4F1E5 / #648273). Bottom-right square is light; a–h and 1–8 are kept in every language.
const PIECES: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export function ChessBoard({ fen, size = 320 }: { fen: string; size?: number }) {
  const placement = fen.split(" ")[0] ?? "";
  const blackToMove = fen.split(" ")[1] === "b";
  const grid: (string | null)[][] = placement.split("/").map((r) => {
    const row: (string | null)[] = [];
    for (const ch of r) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) row.push(null);
      else row.push(ch);
    }
    return row;
  });
  const rows = blackToMove ? [...grid].reverse().map((r) => [...r].reverse()) : grid;
  const files = blackToMove ? "hgfedcba" : "abcdefgh";
  const cell = size / 8;
  return (
    <div>
      <div className="flex">
        <div className="flex flex-col pr-1.5 text-xs text-ink-soft">
          {rows.map((_, r) => <span key={r} className="flex items-center" style={{ height: cell }}>{blackToMove ? r + 1 : 8 - r}</span>)}
        </div>
        <div className="grid overflow-hidden rounded-md" style={{ width: size, height: size, gridTemplateColumns: `repeat(8, ${cell}px)`, gridTemplateRows: `repeat(8, ${cell}px)` }}>
          {rows.flatMap((row, r) =>
            row.map((p, c) => {
              const white = p !== null && p === p.toUpperCase();
              return (
                <div key={`${r}-${c}`} className="flex items-center justify-center overflow-hidden" style={{ width: cell, height: cell, background: (r + c) % 2 ? "#648273" : "#F4F1E5", fontSize: cell * 0.74, lineHeight: 1 }}>
                  {p && (
                    <span aria-hidden style={white
                      ? { color: "#FFFFFF", WebkitTextStroke: `${Math.max(1.5, cell / 18)}px #0B3D2E`, paintOrder: "stroke fill" }
                      : { color: "#0B3D2E" }}>
                      {PIECES[p.toLowerCase()]}
                    </span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="flex pl-4 text-xs text-ink-soft" style={{ width: size + 16 }}>
        {[...files].map((f) => <span key={f} className="text-center" style={{ width: cell }}>{f}</span>)}
      </div>
      <p className="muted mt-1">{blackToMove ? "Black" : "White"} to move</p>
    </div>
  );
}
