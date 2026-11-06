import { notFound } from "next/navigation";
import { publicClub } from "@/lib/publicClub";
import { PublicForm } from "@/components/PublicForm";
import { isLocale } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";

// Chrome-less version for <iframe> embedding on a club's own website (see next.config.mjs for frame-ancestors).
// Language: ?lang=pl|en in the iframe URL, otherwise the visitor's choice, otherwise Polish.
export default async function Embed({ params, searchParams }: { params: Promise<{ slug: string; kind: string }>; searchParams: Promise<{ sent?: string; error?: string; lang?: string }> }) {
  const { slug, kind } = await params;
  if (kind !== "trial" && kind !== "register") notFound();
  const sp = await searchParams;
  const locale = isLocale(sp.lang) ? sp.lang : await getLocale();
  const { club, formGroups } = await publicClub(slug);
  const back = `/embed/${slug}/${kind}`;
  return (
    <main className="bg-white p-4">
      <PublicForm slug={slug} kind={kind === "trial" ? "trial" : "registration"} groups={formGroups} back={back} sent={!!sp.sent} error={!!sp.error} clubName={club.name} locale={locale} />
    </main>
  );
}
