import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, verifyPassword, setPassword, currentSessionId, homeFor, MIN_PASSWORD } from "@/lib/auth";
import { ActionForm, type ActionResult } from "@/components/ActionForm";
import { getT } from "@/lib/i18n/server";

async function change(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const u = await currentUser();
  if (!u) redirect("/login");
  const t = await getT();
  const current = String(fd.get("current") ?? ""), next = String(fd.get("next") ?? ""), again = String(fd.get("again") ?? "");
  if (!(await verifyPassword(u.id, current))) return { ok: false, message: t("Your current password is wrong.") };
  if (next.length < MIN_PASSWORD) return { ok: false, message: t("The new password needs at least {n} characters.", { n: MIN_PASSWORD }) };
  if (next !== again) return { ok: false, message: t("The two new passwords don't match.") };
  if (next === current) return { ok: false, message: t("Choose a password different from the current one.") };
  await setPassword(u.id, next, await currentSessionId());
  redirect(homeFor(u.role));
}

export default async function Account({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  const t = await getT();
  const first = u.mustChangePassword || !!(await searchParams).first;
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      {!first && <Link href={homeFor(u.role)} className="muted">← {t("Back")}</Link>}
      <h1 className="h1 mt-2">{first ? t("Choose your own password") : t("Change password")}</h1>
      <p className="muted mt-1">{first ? t("You signed in with a temporary password. Please set a new one to continue.") : t("Signed in as {email}", { email: u.email })}</p>
      <ActionForm action={change} className="card mt-6 space-y-3">
        <label className="block"><span className="label">{first ? t("Temporary password") : t("Current password")}</span><input className="input" type="password" name="current" required autoComplete="current-password" /></label>
        <label className="block"><span className="label">{t("New password (min. {n} characters)", { n: MIN_PASSWORD })}</span><input className="input" type="password" name="next" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
        <label className="block"><span className="label">{t("Repeat new password")}</span><input className="input" type="password" name="again" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
        <button className="btn btn-lg w-full">{t("Save password")}</button>
      </ActionForm>
      <form action="/logout" method="post" className="mt-4 text-center"><button className="muted underline">{t("Sign out")}</button></form>
    </main>
  );
}
