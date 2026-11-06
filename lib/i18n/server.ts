import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, makeT, type Locale, type T } from "./core";

// Request-scoped store so sync helpers (dates, money) know the current language.
const store = cache(() => ({ locale: DEFAULT_LOCALE as Locale }));

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  const l = isLocale(v) ? v : DEFAULT_LOCALE;
  try { store().locale = l; } catch { /* outside a render */ }
  return l;
}

export async function getT(): Promise<T> {
  return makeT(await getLocale());
}

/** Locale already resolved for this request (falls back to Polish). */
export function currentLocale(): Locale {
  try { return store().locale; } catch { return DEFAULT_LOCALE; }
}
