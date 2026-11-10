export type Role = "platform_admin" | "club_admin" | "coach" | "parent" | "student";
export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type XpReason =
  | "attendance" | "puzzle" | "daily_puzzle" | "streak_bonus"
  | "tournament_game" | "tournament_win" | "bonus" | "learn";
export type BadgeMetric = "sessions" | "puzzles" | "tournaments" | "tournament_wins" | "best_streak" | "xp";
