import { redirect } from "next/navigation";
import { findResetToken, consumeResetToken, MIN_PASSWORD } from "@/lib/auth";
import { ActionForm, type ActionResult } from "@/components/ActionForm";

async function reset(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  "use server";
  const token = String(fd.get("token") ?? ""), next = String(fd.get("next") ?? ""), again = String(fd.get("again") ?? "");
  if (next.length < MIN_PASSWORD) return { ok: false, message: `The password needs at least ${MIN_PASSWORD} characters.` };
  if (next !== again) return { ok: false, message: "The two passwords don't match." };
  if (!(await consumeResetToken(token, next))) return { ok: false, message: "This link has expired or was already used. Please request a new one." };
  redirect("/login?reset=1");
}

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await findResetToken(token);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="h1">Choose a new password</h1>
      {!valid ? (
        <p className="card mt-6 text-sm">This link has expired or was already used. <a className="text-brand underline" href="/forgot-password">Request a new one</a>.</p>
      ) : (
        <ActionForm action={reset} className="card mt-6 space-y-3">
          <input type="hidden" name="token" value={token} />
          <label className="block"><span className="label">New password (min. {MIN_PASSWORD} characters)</span><input className="input" type="password" name="next" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
          <label className="block"><span className="label">Repeat new password</span><input className="input" type="password" name="again" required minLength={MIN_PASSWORD} autoComplete="new-password" /></label>
          <button className="btn w-full">Save password</button>
        </ActionForm>
      )}
    </main>
  );
}
