// Tiny i18n: English source strings are the keys; pl.ts maps them to Polish.
// Missing keys fall back to English. Placeholders: {name}.
import { PL } from "./pl";

export const LOCALES = ["pl", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pl"; // Brand guide: Polish by default, English by choice
export const LOCALE_COOKIE = "cg_lang";

export type Vars = Record<string, string | number>;
export type T = (s: string, vars?: Vars) => string;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

// English labels for internal "prefix:value" keys (status:, method:, interval:, metric:, xp:).
const EN_KEYED: Record<string, string> = {
  "method:cash": "cash", "method:card": "card", "method:transfer": "bank transfer", "method:stripe": "online (Stripe)",
  "interval:month": "month", "interval:semester": "semester", "interval:year": "year", "interval:once": "one-off",
  "metric:sessions": "sessions", "metric:puzzles": "puzzles", "metric:tournaments": "tournaments", "metric:tournament_wins": "tournament wins",
  "metric:best_streak": "days in a row", "metric:xp": "XP",
  "xp:attendance": "attendance", "xp:puzzle": "puzzle", "xp:daily_puzzle": "daily puzzle", "xp:streak_bonus": "Move Trail bonus",
  "xp:tournament_game": "tournament game", "xp:tournament_win": "tournament win", "xp:bonus": "coach bonus",
  "status:past_due": "past due",
};

export function makeT(locale: Locale): T {
  return (s, vars) => {
    let out = locale === "pl" ? (PL[s] ?? s) : (EN_KEYED[s] ?? (/^(status|method|interval|metric|xp):/.test(s) ? s.replace(/^\w+:/, "").replace(/_/g, " ") : s));
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

/** Plural helper: Polish has three forms (1 / 2–4 / 5+). */
export function plural(locale: Locale, n: number, one: string, few: string, many: string) {
  if (locale === "en") return n === 1 ? one : few;
  if (n === 1) return one;
  const m10 = n % 10, m100 = n % 100;
  return m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14) ? few : many;
}

// Chess notation: English K Q R B N ↔ Polish K H W G S (squares a–h, 1–8 unchanged).
const EN2PL: Record<string, string> = { Q: "H", R: "W", B: "G", N: "S" };
const PL2EN: Record<string, string> = { H: "Q", W: "R", G: "B", S: "N" };
export function sanToLocale(san: string, locale: Locale) {
  return locale === "pl" ? san.replace(/[QRBN]/g, (c) => EN2PL[c]) : san;
}
export function sanFromPolish(san: string) {
  return san.replace(/[HWGS]/g, (c) => PL2EN[c]);
}
