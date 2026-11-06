import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "ChessGo Academy", description: "Chess club management" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
