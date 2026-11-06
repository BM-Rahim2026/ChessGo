import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { DEFAULT: "#1f6f5c", dark: "#164f42", light: "#e6f2ee" } } } },
  plugins: [],
} satisfies Config;
