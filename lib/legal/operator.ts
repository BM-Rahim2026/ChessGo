// Operator of the ChessGo service — from the KRS extract (stan na 24.09.2026) and the foundation statute.
export const OPERATOR = {
  name: "Fundacja Młody Sportowiec",
  street: "ul. Plac Tadeusza Kościuszki 5",
  postcode: "41-205",
  city: "Sosnowiec",
  country: "Polska",
  krs: "0000794149",
  court: "Sąd Rejonowy Katowice-Wschód w Katowicach, VIII Wydział Gospodarczy Krajowego Rejestru Sądowego",
  nip: "6443550412",
  regon: "384006031",
  branch: "Oddział w Żarkach-Letnisku, ul. Zielona 31, 42-311 Żarki-Letnisko",
  representation: "Zarząd; każdy członek Zarządu reprezentuje Fundację samodzielnie (Prezes Zarządu: Maciej Bablok)",
  effectiveDate: "2026-11-06",
} as const;

export const nipFormatted = (n: string) => `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;
