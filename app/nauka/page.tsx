import type { Metadata } from "next";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { CHAPTERS } from "@/lib/learn/levels";
import { LearnMap } from "@/components/LearnMap";
import { getLocale } from "@/lib/i18n/server";
import { makeT } from "@/lib/i18n/core";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nauka gry w szachy · ChessGo", description: "Naucz się grać w szachy krok po kroku: ruchy bierek, bicie, szach, mat i roszada." };

export default async function LearnHome() {
  const [user, locale] = await Promise.all([currentUser(), getLocale()]);
  const t = makeT(locale);
  let serverProgress: Record<string, number> | null = null;
  if (user?.role === "student") {
    const s = await db.student.findUnique({ where: { userId: user.id }, include: { learn: true } });
    if (s) serverProgress = Object.fromEntries(s.learn.map((p) => [p.levelId, p.stars]));
  }
  const chapters = CHAPTERS.map((c) => ({
    id: c.id, icon: c.icon, title: c.title[locale], intro: c.intro[locale],
    levels: c.levels.map((l, i) => ({ id: l.id, n: i + 1 })),
  }));
  return (
    <div>
      <h1 className="h1">{t("Learn to play chess")}</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink">{t("Step by step: how the pieces move, capturing, check, checkmate and castling. Collect stars on every level!")}</p>
      {!serverProgress && <p className="muted mt-1 text-sm">{t("Your progress is saved in this browser. Students of the club get XP when they are signed in.")}</p>}
      <div className="mt-6">
        <LearnMap chapters={chapters} serverProgress={serverProgress} labels={{
          levels: t("{n} of {max} levels"), start: t("Start learning"), continue: t("Continue"), total: t("{n} of {max} stars"),
        }} />
      </div>
    </div>
  );
}
