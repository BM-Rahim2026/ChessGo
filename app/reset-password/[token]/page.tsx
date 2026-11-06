import { redirect } from "next/navigation";
import { findResetToken, consumeResetToken, MIN_PASSWORD } from "@/lib/auth";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { Logo } from "@/components/Brand";
import { getT } from "@/lib/i18n/server";

async function reset(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const t = await getT();
  const token = String(fd.get("token") ?? ""), next = String(fd.get("next") ?? ""), again = String(fd.get("again") ?? "");
  if (next.length < MIN_PASSWORD) return { ok: false, message: t("The password needs at least {n} characters.", { n: MIN_PASSWORD }) };
  if (next !== again) return { ok: false, message: t("The two passwords don't match.") };
  if (!(await consumeResetToken(token, next))) return { ok: false, message: t("This link has expired or was already used. Please request a new one.") };
  redirect("/login?reset=1");
}

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await findResetToken(token);
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Logo width={180} className="-ml-[13px]" />
      <h1 className="h1 mt-2">{t("Choose a new password")}</h1>
      {!valid ? (
        <p className="card mt-6 text-sm">{t("This link has expired or was already used.")} <a className="font-semibold text-forest underline" href="/forgot-password">{t("Request a new one")}</a>.</p>
      ) : (
        <ActionForm action={reset} className="card mt-6 space-y-3">
          <input type="hidden" name="token" value={token} />
          <label className="block"><span className="label">{t("New password (min. {n} characters)", { n: MIN_PASSWORD })}</span><input className="input" type="password" name="next" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
          <label className="block"><span className="label">{t("Repeat new password")}</span><input className="input" type="password" name="again" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
          <button className="btn btn-lg w-full">{t("Save password")}</button>
        </ActionForm>
      )}
    </main>
  );
}
