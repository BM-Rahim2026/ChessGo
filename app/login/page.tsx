import { redirect } from "next/navigation";
import { login, homeFor } from "@/lib/auth";

async function doLogin(formData: FormData) {
  "use server";
  const u = await login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!u) redirect("/login?error=1");
  redirect(u.mustChangePassword ? "/account?first=1" : homeFor(u.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const { error, reset } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="text-3xl">♞</div>
      <h1 className="h1 mt-2">Sign in to ChessGo</h1>
      <form action={doLogin} className="card mt-6 space-y-3">
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">Wrong email or password.</p>}
        {reset && <p className="rounded bg-emerald-50 p-2 text-sm text-emerald-900">Password changed. Please sign in.</p>}
        <label className="block"><span className="label">Email</span><input className="input" name="email" type="email" required autoComplete="username" /></label>
        <label className="block"><span className="label">Password</span><input className="input" name="password" type="password" required autoComplete="current-password" /></label>
        <button className="btn w-full">Sign in</button>
        <a href="/forgot-password" className="block text-center text-sm text-brand">Forgot password?</a>
      </form>
    </main>
  );
}
