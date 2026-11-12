import "./fonts.css";
import "./globals.css";
import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/server";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: { default: "ChessGo", template: "%s · ChessGo" },
  description: "Małe ruchy. Wielkie postępy. Small moves. Big progress.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
