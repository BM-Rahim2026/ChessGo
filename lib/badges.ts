import type { BadgeMetric } from "./types";

export const DEFAULT_BADGES: { code: string; name: string; description: string; icon: string; metric: BadgeMetric; threshold: number }[] = [
  { code: "sessions_10", name: "10 sessions", description: "Attended 10 lessons", icon: "📅", metric: "sessions", threshold: 10 },
  { code: "sessions_50", name: "50 sessions", description: "Attended 50 lessons", icon: "🏛", metric: "sessions", threshold: 50 },
  { code: "puzzles_10", name: "Puzzle starter", description: "Solved 10 puzzles", icon: "🧩", metric: "puzzles", threshold: 10 },
  { code: "puzzles_50", name: "50 puzzles", description: "Solved 50 puzzles", icon: "🧠", metric: "puzzles", threshold: 50 },
  { code: "streak_7", name: "7-step Move Trail", description: "Solved the daily puzzle 7 days in a row", icon: "👣", metric: "best_streak", threshold: 7 },
  { code: "first_tournament", name: "First tournament", description: "Played in a club tournament", icon: "♞", metric: "tournaments", threshold: 1 },
  { code: "tournament_winner", name: "Tournament winner", description: "Won a club tournament", icon: "🏆", metric: "tournament_wins", threshold: 1 },
  { code: "xp_1000", name: "1000 XP", description: "Earned 1000 XP", icon: "⭐", metric: "xp", threshold: 1000 },
];
