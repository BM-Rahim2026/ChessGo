import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { CHAPTERS, levelById, nextLevel } from "@/lib/learn/levels";
import { LearnBoard } from "@/components/LearnBoard";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";

export default async function LearnLevel({ params }: { params: Promise<{ level: string }> }) {
  const { level: id } = await params;
  const level = levelById(id);
  if (!level) notFound();
  const [user, locale] = await Promise.all([currentUser(), getLocale()]);
  const t = makeT(locale);
  const chapter = CHAPTERS.find((c) => c.levels.some((l) => l.id === id))!;
  const index = chapter.levels.findIndex((l) => l.id === id);
  const next = nextLevel(id);
  return (
    <div>
      <nav className="mb-4 text-sm"><Link href="/nauka" className="text-forest underline">← {t("All lessons")}</Link></nav>
      <div className="flex flex-wrap gap-8">
        <div className="min-w-0">
          <LearnBoard key={level.id} level={level} isStudent={user?.role === "student"} mapHref="/nauka"
            nextHref={next ? `/nauka/${next.id}` : null}
            labels={{
              moves: t("Moves"), best: t("Best"), wrong: t("Not quite. Try another move!"), done: t("Level complete!"),
              again: t("Try again"), next: t("Next level →"), map: t("All lessons"), savedXp: t("+{n} XP for your stars!"),
              savedLocal: t("Sign in as a student to collect XP."), finishedAll: t("You finished the whole course. Bravo!"), illegal: t("That move is not allowed."),
            }} />
        </div>
        <div className="min-w-[16rem] flex-1">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-3xl text-forest">{chapter.icon}</span>
            <div>
              <p className="text-sm text-ink-soft">{chapter.title[locale]} · {t("Level {n} of {max}", { n: index + 1, max: chapter.levels.length })}</p>
              <h1 className="font-display text-2xl font-semibold text-forest">{level.text[locale]}</h1>
            </div>
          </div>
          <p className="mt-4 rounded-learner bg-white p-4 text-ink shadow-sm">{chapter.intro[locale]}</p>
          <p className="muted mt-3 text-sm">{t("Click a piece, then a highlighted square. You can also drag pieces.")}</p>
        </div>
      </div>
    </div>
  );
}
