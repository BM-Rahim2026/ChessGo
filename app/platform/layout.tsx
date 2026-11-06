import { requireRole } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { getT } from "@/lib/i18n/server";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const u = await requireRole("platform_admin");
  const t = await getT();
  return (
    <Shell title={t("ChessGo Platform")} sub={t("Platform admin")} userName={u.name}
      nav={[{ href: "/platform", label: t("Clubs & billing"), icon: "▦" }, { href: "/platform/new", label: t("New club"), icon: "+" }]}>
      {children}
    </Shell>
  );
}
