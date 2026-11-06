// Static board rendered from FEN (piece placement only).
const PIECES: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export function ChessBoard({ fen, size = 320 }: { fen: string; size?: number }) {
  const placement = fen.split(" ")[0] ?? "";
  const ranks = placement.split("/");
  const blackToMove = fen.split(" ")[1] === "b";
  const grid: (string | null)[][] = ranks.map((r) => {
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
      <div className="grid grid-cols-8 overflow-hidden rounded-md border border-stone-400" style={{ width: size, height: size }}>
        {rows.flatMap((row, r) =>
          row.map((p, c) => (
            <div key={`${r}-${c}`} className={`relative flex items-center justify-center ${(r + c) % 2 ? "bg-[#b58863]" : "bg-[#f0d9b5]"}`}
              style={{ fontSize: cell * 0.72, lineHeight: 1 }}>
              {p ? <span className={p === p.toUpperCase() ? "text-white [text-shadow:0_0_2px_#000]" : "text-black"}>{PIECES[p]}</span> : null}
              {r === 7 && <span className="absolute bottom-0 right-0.5 text-[9px] text-stone-700">{files[c]}</span>}
              {c === 0 && <span className="absolute left-0.5 top-0 text-[9px] text-stone-700">{blackToMove ? r + 1 : 8 - r}</span>}
            </div>
          )),
        )}
      </div>
      <p className="muted mt-1">{blackToMove ? "Black" : "White"} to move</p>
    </div>
  );
}
