import { notFound } from "next/navigation";
import { publicClub } from "@/lib/publicClub";
import { PublicForm } from "@/components/PublicForm";

// Chrome-less version for <iframe> embedding on a club's own website (see next.config.mjs for frame-ancestors).
export default async function Embed({ params, searchParams }: { params: Promise<{ slug: string; kind: string }>; searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { slug, kind } = await params;
  if (kind !== "trial" && kind !== "register") notFound();
  const sp = await searchParams;
  const { club, formGroups } = await publicClub(slug);
  return (
    <main className="bg-white p-4">
      <PublicForm slug={slug} kind={kind === "trial" ? "trial" : "registration"} groups={formGroups} back={`/embed/${slug}/${kind}`} sent={!!sp.sent} error={!!sp.error} clubName={club.name} />
    </main>
  );
}
