import { Shell } from "@/components/Shell";
import { portalContext } from "@/lib/portal";
import { getT } from "@/lib/i18n/server";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, club } = await portalContext();
  const t = await getT();
  const nav = user.role === "student"
    ? [{ href: "/portal", label: t("My progress"), icon: "★" }, { href: "/portal/puzzle", label: t("Daily puzzle"), icon: "🧩" }]
    : [{ href: "/portal", label: t("My children"), icon: "☺" }, { href: "/portal/shop", label: t("Club shop"), icon: "🛍" }, { href: "/portal/orders", label: t("My orders"), icon: "📦" }];
  return <Shell title={club.name} sub={user.role === "student" ? t("Student") : t("Parent")} nav={nav} userName={user.name}>{children}</Shell>;
}
