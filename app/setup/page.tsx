import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { hashPassword, login, MIN_PASSWORD } from "@/lib/auth";
import { DEFAULT_BADGES } from "@/lib/badges";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { Logo } from "@/components/Brand";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getT, getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

// One-time, in-browser setup for a fresh installation.
// Only works while SETUP_TOKEN is set AND no platform admin exists yet; afterwards it is permanently closed.

async function isOpen() {
  return !!process.env.SETUP_TOKEN && (await db.user.count({ where: { role: "platform_admin" } })) === 0;
}

function tokenOk(given: string) {
  const want = Buffer.from(process.env.SETUP_TOKEN ?? "");
  const got = Buffer.from(given);
  return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}

async function runSetup(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  if (!(await isOpen())) return { ok: false, message: t("Setup is already complete.") };
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  if (!tokenOk(v("token"))) return { ok: false, message: t("Wrong setup code. It must match SETUP_TOKEN in Vercel.") };
  const pEmail = v("platformEmail").toLowerCase(), cEmail = v("clubEmail").toLowerCase();
  const slug = v("slug").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!pEmail || !cEmail || !slug || !v("clubName")) return { ok: false, message: t("Please fill in every field.") };
  if (pEmail === cEmail) return { ok: false, message: t("Use two different emails: one login can only have one role.") };
  if (v("platformPw").length < MIN_PASSWORD || v("clubPw").length < MIN_PASSWORD) return { ok: false, message: t("Passwords need at least {n} characters.", { n: MIN_PASSWORD }) };
  if (await db.user.findFirst({ where: { email: { in: [pEmail, cEmail] } } })) return { ok: false, message: t("One of these emails already has a login.") };

  await db.$transaction(async (tx) => {
    await tx.user.create({ data: { email: pEmail, name: v("platformName") || "Platform Admin", role: "platform_admin", passwordHash: await hashPassword(v("platformPw")) } });
    const club = await tx.club.upsert({
      where: { slug }, update: {},
      create: { slug, name: v("clubName"), email: cEmail, currency: "pln", trialEndsAt: new Date(), billingStatus: "active" },
    });
    for (const b of DEFAULT_BADGES) await tx.badge.upsert({ where: { clubId_code: { clubId: club.id, code: b.code } }, update: {}, create: { ...b, clubId: club.id } });
    await tx.user.create({ data: { email: cEmail, name: v("clubName2") || v("platformName") || "Club Admin", role: "club_admin", clubId: club.id, passwordHash: await hashPassword(v("clubPw")) } });
  });
  await login(cEmail, v("clubPw"));
  redirect("/admin/club");
}

export default async function Setup() {
  const locale = await getLocale();
  const t = await getT();
  if (!(await isOpen())) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="h1">{t("Setup is closed")}</h1>
        <p className="muted mt-2">{process.env.SETUP_TOKEN ? t("This installation is already set up.") : t("Set SETUP_TOKEN in your hosting settings to enable first-time setup.")}</p>
        <a className="btn mt-6" href="/login">{t("Sign in")}</a>
      </main>
    );
  }
  const F = ({ label, name, type = "text", hint, def }: { label: string; name: string; type?: string; hint?: string; def?: string }) => (
    <label className="block"><span className="label">{label}</span><input className="input" name={name} type={type} required defaultValue={def} minLength={name.endsWith("Pw") ? MIN_PASSWORD : undefined} />{hint && <span className="muted text-xs">{hint}</span>}</label>
  );
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <div className="flex items-center justify-between gap-3"><Logo width={220} className="-ml-[15px]" /><LanguageSwitch locale={locale} /></div>
      <h1 className="h1 mt-2">{t("Set up ChessGo")}</h1>
      <p className="muted mt-1">{t("One time only. Creates your two logins and your club. This page closes itself afterwards.")}</p>
      <ActionForm action={runSetup} className="mt-6 space-y-6">
        <div className="card space-y-3">
          <F label={t("Setup code")} name="token" type="password" hint={t("The SETUP_TOKEN value you entered in Vercel.")} />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">{t("Your club")}</h2>
          <F label={t("Club name")} name="clubName" def="ChessGo Academy" />
          <F label={t("Web address of the public page")} name="slug" def="chessgo" hint={t("Your club page will be at /c/this-name")} />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">{t("Club admin login")}</h2>
          <p className="muted">{t("For running the academy every day.")}</p>
          <F label={t("Your name")} name="clubName2" />
          <F label={t("Email")} name="clubEmail" type="email" />
          <F label={t("Password (min. {n} characters)", { n: MIN_PASSWORD })} name="clubPw" type="password" />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">{t("Platform admin login")}</h2>
          <p className="muted">{t("For ChessGo billing across clubs. Needs a different email from the one above.")}</p>
          <F label={t("Your name")} name="platformName" />
          <F label={t("Email")} name="platformEmail" type="email" />
          <F label={t("Password (min. {n} characters)", { n: MIN_PASSWORD })} name="platformPw" type="password" />
        </div>
        <button className="btn btn-lg w-full">{t("Finish setup")}</button>
      </ActionForm>
    </main>
  );
}
