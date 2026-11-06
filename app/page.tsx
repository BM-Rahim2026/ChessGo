import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/Brand";

export default async function Home() {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const clubs = await db.club.findMany({ select: { slug: true, name: true }, take: 10 });
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Logo width={300} className="-ml-[19px]" />
      <h1 className="mt-4 font-display text-[40px] font-semibold leading-[48px] text-forest">Small moves. Big progress.</h1>
      <p className="mt-3 text-lg text-ink-soft">Groups, attendance, puzzles, tournaments and payments for your chess club, in one place.</p>
      <div className="mt-8 flex gap-2">
        <Link className="btn btn-lg" href="/login">Sign in</Link>
      </div>
      {clubs.length > 0 && (
        <div className="mt-10">
          <div className="label">Public club pages</div>
          <ul className="mt-2 space-y-1">
            {clubs.map((c) => <li key={c.slug}><Link className="font-semibold text-forest underline" href={`/c/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </div>
      )}
    </main>
  );
}
