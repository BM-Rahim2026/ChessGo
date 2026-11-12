import { redirect } from "next/navigation";
import { login, homeFor } from "@/lib/auth";
import { Logo } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { LegalLinks } from "@/components/LegalLinks";
import { SubmitButton } from "@/components/SubmitButton";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

async function doLogin(formData: FormData) {
  "use server";
  const u = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!u) redirect("/login?error=1");
  redirect(u.mustChangePassword ? "/account?first=1" : homeFor(u.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;
  const locale = await getLocale();
  const t = makeT(locale);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="flex items-center justify-between gap-3"><Logo width={220} className="-ml-[15px]" /><LanguageSwitch locale={locale} /></div>
      <h1 className="h1 mt-2">{t("Welcome back")}</h1>
      <p className="muted mt-1">{t("Sign in to your club.")}</p>
      <form action={doLogin} className="card mt-6 space-y-3">
        {error && <p className="rounded-control bg-red-50 p-2 text-sm text-red-700">{t("Wrong email or password.")} {t("Check the address carefully (demo accounts: copy it from Students → Demo account).")}</p>}
        {reset && <p className="rounded-control bg-mint p-2 text-sm text-forest">{t("Password changed. Please sign in.")}</p>}
        <label className="block"><span className="label">{t("Email")}</span><input className="input" name="email" type="email" required autoComplete="username" /></label>
        <label className="block"><span className="label">{t("Password")}</span><input className="input" name="password" type="password" required autoComplete="current-password" /></label>
        <SubmitButton className="btn btn-lg w-full" pending={t("Signing in…")}>{t("Sign in")}</SubmitButton>
        <a href="/forgot-password" className="block text-center text-sm font-semibold text-forest underline">{t("Forgot password?")}</a>
      </form>
      <LegalLinks t={t} className="mt-6 justify-center text-center" />
    </main>
  );
}
