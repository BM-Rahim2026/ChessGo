import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const clubs = await db.club.findMany({ select: { slug: true, name: true }, take: 10 });
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-4xl">♞</div>
      <h1 className="mt-2 text-3xl font-semibold">ChessGo Academy</h1>
      <p className="muted mt-2">Club management for chess academies: groups, attendance, payments, gamification, shop and reports.</p>
      <div className="mt-6 flex gap-2">
        <Link className="btn" href="/login">Sign in</Link>
      </div>
      {clubs.length > 0 && (
        <div className="mt-10">
          <div className="label">Public club pages</div>
          <ul className="mt-2 space-y-1">
            {clubs.map((c) => <li key={c.slug}><Link className="text-brand underline" href={`/c/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </div>
      )}
    </main>
  );
}
