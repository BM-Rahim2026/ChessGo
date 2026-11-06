import type { Config } from "tailwindcss";

// ChessGo brand tokens (Brand guidelines v1.1, p. 8–10, 15).
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#0B3D2E", dark: "#082C21" }, // Club Forest: text & primary actions
        chess: "#59D706", // Chess Green: learning & energy (never as text on light)
        go: "#FDDA05", // Go Yellow: rewards & emphasis (never as text on light)
        cream: "#FAF8EF", // Warm Cream: main background
        mint: "#EAF5E9", // Quiet Mint: cards & feedback
        ink: { DEFAULT: "#17332B", soft: "#4F6259" }, // Reading Ink; soft = supporting copy (6.26:1)
        board: { light: "#F4F1E5", dark: "#648273" }, // Club Classic board
        medal: { gold: "#B8860B", silver: "#7A8B99", bronze: "#A65A2E" },
        league: { discovery: "#59D706", progress: "#2366A8", strategy: "#7E57C2", mastery: "#B8860B" },
        // Back-compat alias used across the app
        brand: { DEFAULT: "#0B3D2E", dark: "#082C21", light: "#EAF5E9" },
      },
      fontFamily: {
        display: ['"Readex Pro"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: { control: "12px", card: "16px", learner: "24px" },
    },
  },
  plugins: [],
} satisfies Config;
