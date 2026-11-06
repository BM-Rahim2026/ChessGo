import { getT } from "@/lib/i18n/server";

// Club Classic board (#F4F1E5 / #648273). Bottom-right square is light; a–h and 1–8 are kept in every language.
// Responsive: never wider than the screen (cell = min(size/8, (100vw − 88px)/8)).
const PIECES: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

export async function ChessBoard({ fen, size = 320 }: { fen: string; size?: number }) {
  const t = await getT();
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
  const cell = `min(${size / 8}px, calc((100vw - 88px) / 8))`;
  return (
    <div style={{ ["--cell" as string]: cell }}>
      <div className="grid" style={{ gridTemplateColumns: "16px repeat(8, var(--cell))", gridTemplateRows: "repeat(8, var(--cell))" }}>
        {rows.map((row, r) => [
          <span key={`r${r}`} className="flex items-center text-xs text-ink-soft" style={{ gridColumn: 1, gridRow: r + 1 }}>{blackToMove ? r + 1 : 8 - r}</span>,
          ...row.map((p, c) => {
            const white = p !== null && p === p.toUpperCase();
            const corner = r === 0 && c === 0 ? "rounded-tl-md" : r === 0 && c === 7 ? "rounded-tr-md" : r === 7 && c === 0 ? "rounded-bl-md" : r === 7 && c === 7 ? "rounded-br-md" : "";
            return (
              <div key={`${r}-${c}`} className={`flex items-center justify-center overflow-hidden ${corner}`}
                style={{ gridColumn: c + 2, gridRow: r + 1, background: (r + c) % 2 ? "#648273" : "#F4F1E5", fontSize: "calc(var(--cell) * 0.74)", lineHeight: 1 }}>
                {p && (
                  <span aria-hidden style={white
                    ? { color: "#FFFFFF", WebkitTextStroke: "calc(var(--cell) / 18) #0B3D2E", paintOrder: "stroke fill" }
                    : { color: "#0B3D2E" }}>
                    {PIECES[p.toLowerCase()]}
                  </span>
                )}
              </div>
            );
          }),
        ])}
      </div>
      <div className="grid text-xs text-ink-soft" style={{ gridTemplateColumns: "16px repeat(8, var(--cell))" }}>
        <span />
        {[...files].map((f) => <span key={f} className="text-center">{f}</span>)}
      </div>
      <p className="muted mt-1">{blackToMove ? t("Black to move") : t("White to move")}</p>
    </div>
  );
}
