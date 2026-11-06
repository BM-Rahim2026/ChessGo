// Daily puzzle streak arithmetic on YYYY-MM-DD keys.

function prevDay(key: string): string {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextStreak(lastDay: string | null, today: string, current: number): { streak: number; changed: boolean } {
  if (lastDay === today) return { streak: current, changed: false };
  if (lastDay && lastDay === prevDay(today)) return { streak: current + 1, changed: true };
  return { streak: 1, changed: true };
}

/** Streak shown to the user: it is broken if neither today nor yesterday was solved. */
export function displayStreak(lastDay: string | null, today: string, current: number): number {
  if (!lastDay) return 0;
  return lastDay === today || lastDay === prevDay(today) ? current : 0;
}

export const STREAK_BONUS_EVERY = 7;
export const STREAK_BONUS_XP = 25;
