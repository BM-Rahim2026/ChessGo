import Link from "next/link";
import { publicClub } from "@/lib/publicClub";
import { PublicForm } from "@/components/PublicForm";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ sent?: string; error?: string; group?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const t = makeT(locale);
  const { club, formGroups } = await publicClub(slug);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href={`/c/${slug}`} className="muted">← {club.name}</Link>
        <LanguageSwitch locale={locale} />
      </div>
      <h1 className="h1 mt-2 mb-6">{t("Registration")}</h1>
      <div className="card">
        <PublicForm slug={slug} kind="registration" groups={formGroups} back={`/c/${slug}/register`} sent={!!sp.sent} error={!!sp.error} clubName={club.name} locale={locale} defaultGroup={sp.group} />
      </div>
    </main>
  );
}
