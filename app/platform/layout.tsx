import { requireRole } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole("platform_admin");
  return (
    <Shell title="ChessGo Platform" sub="Platform admin" userName={u.name}
      nav={[{ href: "/platform", label: "Clubs & billing", icon: "▦" }, { href: "/platform/new", label: "New club", icon: "+" }]}>
      {children}
    </Shell>
  );
}
