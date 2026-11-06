import { NextResponse } from "next/server";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/core";

// Switch language and go back. The choice is kept for a year (across sessions).
export async function POST(req: Request) {
  const fd = await req.formData();
  const to = fd.get("to");
  const back = String(fd.get("back") ?? "/");
  const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const res = NextResponse.redirect(new URL(safeBack, req.url), 303);
  if (isLocale(to)) res.cookies.set(LOCALE_COOKIE, to, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}
