import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { hashPassword, login, MIN_PASSWORD } from "@/lib/auth";
import { DEFAULT_BADGES } from "@/lib/badges";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { Logo } from "@/components/Brand";

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
  if (!(await isOpen())) return { ok: false, message: "Setup is already complete." };
  const v = (k: string) => String(fd.get(k) ?? "").trim();
  if (!tokenOk(v("token"))) return { ok: false, message: "Wrong setup code. It must match SETUP_TOKEN in Vercel." };
  const pEmail = v("platformEmail").toLowerCase(), cEmail = v("clubEmail").toLowerCase();
  const slug = v("slug").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!pEmail || !cEmail || !slug || !v("clubName")) return { ok: false, message: "Please fill in every field." };
  if (pEmail === cEmail) return { ok: false, message: "Use two different emails: one login can only have one role." };
  if (v("platformPw").length < MIN_PASSWORD || v("clubPw").length < MIN_PASSWORD) return { ok: false, message: `Passwords need at least ${MIN_PASSWORD} characters.` };
  if (await db.user.findFirst({ where: { email: { in: [pEmail, cEmail] } } })) return { ok: false, message: "One of these emails already has a login." };

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
  if (!(await isOpen())) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="h1">Setup is closed</h1>
        <p className="muted mt-2">{process.env.SETUP_TOKEN ? "This installation is already set up." : "Set SETUP_TOKEN in your hosting settings to enable first-time setup."}</p>
        <a className="btn mt-6" href="/login">Sign in</a>
      </main>
    );
  }
  const F = ({ label, name, type = "text", hint, def }: { label: string; name: string; type?: string; hint?: string; def?: string }) => (
    <label className="block"><span className="label">{label}</span><input className="input" name={name} type={type} required defaultValue={def} minLength={name.endsWith("Pw") ? MIN_PASSWORD : undefined} />{hint && <span className="muted text-xs">{hint}</span>}</label>
  );
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <Logo width={220} className="-ml-[15px]" />
      <h1 className="h1 mt-2">Set up ChessGo</h1>
      <p className="muted mt-1">One time only. Creates your two logins and your club. This page closes itself afterwards.</p>
      <ActionForm action={runSetup} className="mt-6 space-y-6">
        <div className="card space-y-3">
          <F label="Setup code" name="token" type="password" hint="The SETUP_TOKEN value you entered in Vercel." />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Your club</h2>
          <F label="Club name" name="clubName" def="ChessGo Academy" />
          <F label="Web address of the public page" name="slug" def="chessgo" hint="Your club page will be at /c/this-name" />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Club admin login</h2>
          <p className="muted">For running the academy every day.</p>
          <F label="Your name" name="clubName2" />
          <F label="Email" name="clubEmail" type="email" />
          <F label={`Password (min. ${MIN_PASSWORD} characters)`} name="clubPw" type="password" />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Platform admin login</h2>
          <p className="muted">For ChessGo billing across clubs. Needs a different email from the one above.</p>
          <F label="Your name" name="platformName" />
          <F label="Email" name="platformEmail" type="email" />
          <F label={`Password (min. ${MIN_PASSWORD} characters)`} name="platformPw" type="password" />
        </div>
        <button className="btn btn-lg w-full">Finish setup</button>
      </ActionForm>
    </main>
  );
}
