import type { Level } from "./engine";

/** ChessGo "Nauka" course: original levels, easiest first. Texts in Polish and English. */
export type Chapter = { id: string; icon: string; title: { pl: string; en: string }; intro: { pl: string; en: string }; levels: Level[] };

const L = (id: string, goal: Level["goal"], data: Partial<Level>, pl: string, en: string): Level => ({ id, goal, ...data, text: { pl, en } });

export const CHAPTERS: Chapter[] = [
  {
    id: "wieza", icon: "♜", title: { pl: "Wieża", en: "The rook" },
    intro: { pl: "Wieża chodzi po liniach prostych: w górę, w dół, w lewo i w prawo — tak daleko, jak chce.", en: "The rook moves in straight lines: up, down, left and right, as far as it likes." },
    levels: [
      L("wieza-1", "collect", { pieces: "Ra1", stars: ["a6"] }, "Przesuń wieżę na gwiazdkę.", "Move the rook to the star."),
      L("wieza-2", "collect", { pieces: "Ra1", stars: ["a8", "h8"] }, "Zbierz obie gwiazdki.", "Collect both stars."),
      L("wieza-3", "collect", { pieces: "Rd4", stars: ["d8", "a8", "a1", "h1"] }, "Zbierz wszystkie gwiazdki jak najszybciej.", "Collect all the stars as fast as you can."),
      L("wieza-4", "collect", { pieces: "Rh1", stars: ["c3", "c7", "f7", "f2"] }, "Wieża nie skacze na ukos — zaplanuj drogę!", "The rook can't go diagonally — plan your route!"),
    ],
  },
  {
    id: "goniec", icon: "♝", title: { pl: "Goniec", en: "The bishop" },
    intro: { pl: "Goniec chodzi po przekątnych i zawsze zostaje na polach jednego koloru.", en: "The bishop moves diagonally and always stays on squares of one colour." },
    levels: [
      L("goniec-1", "collect", { pieces: "Bc1", stars: ["f4"] }, "Przesuń gońca na gwiazdkę.", "Move the bishop to the star."),
      L("goniec-2", "collect", { pieces: "Bf1", stars: ["b5", "e8"] }, "Zbierz obie gwiazdki.", "Collect both stars."),
      L("goniec-3", "collect", { pieces: "Bc1", stars: ["h6", "a3", "e7", "b8"] }, "Cztery gwiazdki — znajdź najkrótszą drogę.", "Four stars — find the shortest route."),
    ],
  },
  {
    id: "hetman", icon: "♛", title: { pl: "Hetman", en: "The queen" },
    intro: { pl: "Hetman łączy ruchy wieży i gońca. To najsilniejsza bierka!", en: "The queen moves like a rook and a bishop together. She is the strongest piece!" },
    levels: [
      L("hetman-1", "collect", { pieces: "Qd1", stars: ["h5", "h8"] }, "Hetman chodzi prosto i na ukos. Zbierz gwiazdki.", "The queen moves straight and diagonally. Collect the stars."),
      L("hetman-2", "collect", { pieces: "Qd4", stars: ["a1", "h8", "a7", "g1", "d8"] }, "Pięć gwiazdek — pokaż siłę hetmana!", "Five stars — show the queen's power!"),
    ],
  },
  {
    id: "krol", icon: "♚", title: { pl: "Król", en: "The king" },
    intro: { pl: "Król chodzi tylko o jedno pole, w każdą stronę. Jest najważniejszy — trzeba go chronić.", en: "The king moves only one square, in any direction. He is the most important piece — keep him safe." },
    levels: [
      L("krol-1", "collect", { pieces: "Ke1", stars: ["e3"] }, "Doprowadź króla do gwiazdki.", "Walk the king to the star."),
      L("krol-2", "collect", { pieces: "Ke4", stars: ["d6", "f6", "g4"] }, "Król idzie powoli — zbierz trzy gwiazdki.", "The king walks slowly — collect three stars."),
    ],
  },
  {
    id: "skoczek", icon: "♞", title: { pl: "Skoczek", en: "The knight" },
    intro: { pl: "Skoczek skacze w kształcie litery L: dwa pola prosto i jedno w bok. Może przeskakiwać inne bierki.", en: "The knight jumps in an L shape: two squares straight and one to the side. It can jump over pieces." },
    levels: [
      L("skoczek-1", "collect", { pieces: "Nb1", stars: ["c3"] }, "Skocz skoczkiem na gwiazdkę.", "Jump the knight to the star."),
      L("skoczek-2", "collect", { pieces: "Nb1", stars: ["c3", "e4", "f6"] }, "Skacz od gwiazdki do gwiazdki.", "Jump from star to star."),
      L("skoczek-3", "collect", { pieces: "Ng1", stars: ["h3", "g5", "e6", "c5"] }, "Trudniejsza trasa — licz skoki!", "A trickier route — count your jumps!"),
    ],
  },
  {
    id: "pion", icon: "♟", title: { pl: "Pion", en: "The pawn" },
    intro: { pl: "Pion idzie do przodu o jedno pole (z pierwszego ruchu może o dwa), a bije na ukos. Na końcu planszy zamienia się w hetmana!", en: "The pawn moves forward one square (two on its first move) and captures diagonally. At the far end it becomes a queen!" },
    levels: [
      L("pion-1", "collect", { pieces: "Pe2", stars: ["e4"] }, "Pierwszy ruch piona może mieć dwa pola.", "A pawn's first move can be two squares."),
      L("pion-2", "collect", { pieces: "Pc2 pd3", stars: ["d5"] }, "Piony biją na ukos. Zbij czarnego piona i dojdź do gwiazdki.", "Pawns capture diagonally. Take the black pawn and reach the star."),
      L("pion-3", "collect", { pieces: "Pa6", stars: ["a8", "h1"] }, "Dojdź do końca planszy — pion zamieni się w hetmana!", "Reach the end of the board — the pawn becomes a queen!"),
    ],
  },
  {
    id: "bicie", icon: "⚔", title: { pl: "Bicie", en: "Capturing" },
    intro: { pl: "Bijesz, stając na polu bierki przeciwnika. Zbij wszystkie czarne bierki!", en: "You capture by moving onto an opponent's piece. Take all the black pieces!" },
    levels: [
      L("bicie-1", "capture", { pieces: "Ra1 pa5 pe5" }, "Zbij oba czarne piony wieżą.", "Capture both black pawns with the rook."),
      L("bicie-2", "capture", { pieces: "Bc1 nf4 ph6 pd8" }, "Goniec poluje na ukos.", "The bishop hunts diagonally."),
      L("bicie-3", "capture", { pieces: "Nb1 pc3 pe4 pg5" }, "Skocz i zbij wszystko.", "Jump and capture everything."),
      L("bicie-4", "capture", { pieces: "Qd1 pd5 rh5 bh1 na4" }, "Hetman sprząta całą planszę!", "The queen clears the board!"),
    ],
  },
  {
    id: "szach", icon: "+", title: { pl: "Szach", en: "Check" },
    intro: { pl: "Szach to atak na króla. Daj szacha jednym ruchem.", en: "Check means attacking the king. Give check in one move." },
    levels: [
      L("szach-1", "check", { fen: "4k3/8/8/8/8/8/8/R3K3 w - - 0 1" }, "Zaatakuj czarnego króla wieżą.", "Attack the black king with the rook."),
      L("szach-2", "check", { fen: "4k3/7p/8/8/8/8/P7/4KB2 w - - 0 1" }, "Daj szacha gońcem.", "Give check with the bishop."),
      L("szach-3", "check", { fen: "4k3/7p/8/8/4N3/8/P7/4K3 w - - 0 1" }, "Daj szacha skoczkiem.", "Give check with the knight."),
    ],
  },
  {
    id: "obrona", icon: "🛡", title: { pl: "Ucieczka przed szachem", en: "Getting out of check" },
    intro: { pl: "Gdy twój król jest szachowany, musisz go ratować: ucieknij, zasłoń się albo zbij atakującą bierkę.", en: "When your king is in check you must save him: move away, block, or capture the attacker." },
    levels: [
      L("obrona-1", "escape", { fen: "k7/8/8/4r3/8/8/8/4K3 w - - 0 1" }, "Wieża szachuje twojego króla. Ucieknij!", "The rook is checking your king. Run!"),
      L("obrona-2", "escape", { fen: "k7/8/8/8/8/8/3q4/4K3 w - - 0 1" }, "Hetman stoi tuż obok i nikt go nie broni…", "The queen is right next to you and nobody protects her…"),
      L("obrona-3", "escape", { fen: "k7/8/8/8/1b6/8/8/R3K3 w - - 0 1" }, "Goniec szachuje. Uratuj króla.", "The bishop gives check. Save your king."),
    ],
  },
  {
    id: "mat", icon: "♔", title: { pl: "Mat w 1", en: "Mate in 1" },
    intro: { pl: "Mat to szach, przed którym nie ma ucieczki — koniec partii! Znajdź ruch dający mata.", en: "Checkmate is a check with no escape — game over! Find the mating move." },
    levels: [
      L("mat-1", "mate", { fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1" }, "Czarne piony zamknęły swojego króla. Wykorzystaj to!", "The black pawns have trapped their own king. Use it!"),
      L("mat-2", "mate", { fen: "k7/8/1K6/8/8/8/8/7Q w - - 0 1" }, "Twój król pomaga hetmanowi.", "Your king helps the queen."),
      L("mat-3", "mate", { fen: "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1" }, "Król jest otoczony własnymi bierkami…", "The king is surrounded by his own pieces…"),
      L("mat-4", "mate", { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4" }, "Słaby punkt czarnych to pole f7.", "Black's weak spot is the f7 square."),
    ],
  },
  {
    id: "roszada", icon: "♖", title: { pl: "Roszada", en: "Castling" },
    intro: { pl: "Roszada to specjalny ruch: król idzie o dwa pola w stronę wieży, a wieża przeskakuje obok niego. Kliknij króla.", en: "Castling is a special move: the king moves two squares towards the rook and the rook jumps next to him. Click the king." },
    levels: [
      L("roszada-1", "castle", { fen: "4k3/8/8/8/8/8/5PPP/4K2R w K - 0 1" }, "Zrób krótką roszadę (król na g1).", "Castle kingside (king to g1)."),
      L("roszada-2", "castle", { fen: "4k3/8/8/8/8/8/PPP5/R3K3 w Q - 0 1" }, "Zrób długą roszadę (król na c1).", "Castle queenside (king to c1)."),
    ],
  },
];

export const ALL_LEVELS = CHAPTERS.flatMap((c) => c.levels.map((l) => ({ ...l, chapter: c.id })));
export const levelById = (id: string) => ALL_LEVELS.find((l) => l.id === id) ?? null;
export function nextLevel(id: string) {
  const i = ALL_LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < ALL_LEVELS.length ? ALL_LEVELS[i + 1] : null;
}
