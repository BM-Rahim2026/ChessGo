import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { sendEmail, appUrl } from "@/lib/email";
import { Logo } from "@/components/Brand";
import { getT } from "@/lib/i18n/server";

async function request(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").toLowerCase().trim();
  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  if (user) {
    const recent = await db.passwordResetToken.count({ where: { userId: user.id, expiresAt: { gt: new Date(Date.now() + 50 * 60_000) } } });
    if (recent < 3) {
      const token = await createResetToken(user.id);
      const t = await getT();
      await sendEmail(user.email, t("Reset your ChessGo password"),
        t("Hi {name},\n\nUse this link to choose a new password (valid for 1 hour):\n{link}\n\nIf you didn't ask for this, you can ignore this email.\n", { name: user.name, link: `${appUrl()}/reset-password/${token}` }));
    }
  }
  redirect("/forgot-password?sent=1"); // same answer whether or not the email exists
}

export default async function Forgot({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Logo width={180} className="-ml-[13px]" />
      <h1 className="h1 mt-2">{t("Forgot your password?")}</h1>
      {sent ? (
        <p className="card mt-6 text-sm">{t("If an account exists for that email, we've sent a link to reset the password. It's valid for one hour. Can't find it? Check spam, or ask the club to reset it for you.")}</p>
      ) : (
        <form action={request} className="card mt-6 space-y-3">
          <label className="block"><span className="label">{t("Email")}</span><input className="input" name="email" type="email" required /></label>
          <button className="btn btn-lg w-full">{t("Send reset link")}</button>
        </form>
      )}
      <a href="/login" className="mt-4 text-center text-sm font-semibold text-forest underline">{t("Back to sign in")}</a>
    </main>
  );
}
