/** English copy: "PLN 120.00" / "€60.00". */
export function money(cts: number, currency = "pln") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: currency.toUpperCase() }).format(cts / 100);
}
export const TIME_ZONE = "Europe/Warsaw";

/** Calendar day in Poland (Europe/Warsaw) as YYYY-MM-DD, regardless of the server's time zone. */
export function dayKey(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function monthKey(d: Date = new Date()) {
  return dayKey(d).slice(0, 7);
}
/** "5 November 2026" (brand format), in Polish time. */
export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });
}
export const WEEKDAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
