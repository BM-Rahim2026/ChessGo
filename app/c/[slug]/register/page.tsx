import Link from "next/link";
import { publicClub } from "@/lib/publicClub";
import { PublicForm } from "@/components/PublicForm";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { club, formGroups } = await publicClub(slug);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/c/${slug}`} className="muted">← {club.name}</Link>
      <h1 className="h1 mt-2 mb-6">Registration</h1>
      <div className="card">
        <PublicForm slug={slug} kind="registration" groups={formGroups} back={`/c/${slug}/register`} sent={!!sp.sent} error={!!sp.error} clubName={club.name} />
      </div>
    </main>
  );
}
