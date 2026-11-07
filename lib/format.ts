import { currentLocale } from "./i18n/server";

/** Polish: "120,00 zł". English: "PLN 120.00" (brand guide p. 11). */
export function money(cts: number, currency = "pln") {
  const pl = currentLocale() === "pl";
  const cur = currency.toUpperCase();
  if (!pl && cur === "PLN") return `PLN ${(cts / 100).toFixed(2)}`;
  return new Intl.NumberFormat(pl ? "pl-PL" : "en-IE", { style: "currency", currency: cur }).format(cts / 100);
}
export const TIME_ZONE = "Europe/Warsaw";

/** Calendar day in Poland (Europe/Warsaw) as YYYY-MM-DD, regardless of the server's time zone. */
export function dayKey(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function monthKey(d: Date = new Date()) {
  return dayKey(d).slice(0, 7);
}
/** "5 listopada 2026" / "5 November 2026", in Polish time. */
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(currentLocale() === "pl" ? "pl-PL" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
}
const WD = { en: ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], pl: ["", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"] };
/** Short weekday name, 1 = Monday … 7 = Sunday. */
export function weekday(n: number) {
  return WD[currentLocale()][n] ?? "";
}
export function toCents(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
export function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
export function optStr(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

/** Phone: 9–15 digits, optional leading +, spaces, dashes or brackets. Used as the HTML pattern too. */
export const PHONE_PATTERN = "\\+?[0-9 \\(\\)\\-]{9,22}";
export function validPhone(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  const digits = s.replace(/\D/g, "").length;
  return /^\+?[0-9 ()\-]+$/.test(s) && digits >= 9 && digits <= 15;
}
export function validEmail(v: string | null | undefined): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v ?? "").trim());
}
/** All four parent fields present and valid. */
export function validParent(p: { firstName: string; lastName: string; email: string; phone: string }): boolean {
  return Boolean(p.firstName.trim() && p.lastName.trim() && validEmail(p.email) && validPhone(p.phone));
}
