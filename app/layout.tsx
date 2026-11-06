import "./fonts.css";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "ChessGo", template: "%s · ChessGo" },
  description: "Small moves. Big progress. Chess club management for academies and schools.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
