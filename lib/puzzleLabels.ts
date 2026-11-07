import type { PuzzleLabels } from "@/components/PuzzleBoard";

/** Board texts in the current language (keys are English, Polish in lib/i18n/pl/portal.ts). */
export function puzzleLabels(t: (s: string) => string): PuzzleLabels {
  return {
    yourMove: t("Your move: click a piece, then a square."),
    whiteToMove: t("White to move"),
    blackToMove: t("Black to move"),
    correct: t("Correct! Wait for the reply…"),
    wrong: t("Not this move. Try again!"),
    solved: t("Solved! Well played."),
    solvedByMate: t("Checkmate! Solved."),
    xp: "XP",
    already: t("You have already solved this puzzle. You can play it again for practice."),
    retry: t("Play again"),
    reset: t("Start over"),
    hint: t("Hint"),
    showSolution: t("Show solution"),
    testMode: t("Test mode: moves are checked like for students, but no XP is given."),
    error: t("Something went wrong. Reload the page."),
    promote: t("Promote to:"),
  };
}
