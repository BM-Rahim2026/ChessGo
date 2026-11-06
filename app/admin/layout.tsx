import { requireStaff } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";
import { trialDaysLeft } from "@/lib/billing";
import { getT } from "@/lib/i18n/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, club } = await requireStaff();
  const isAdmin = user.role === "club_admin";
  const t = await getT();
  const nav: NavItem[] = [
    { href: "/admin", label: t("Dashboard"), icon: "▦" },
    { href: "/admin/groups", label: t("Groups & schedule"), icon: "◫" },
    { href: "/admin/students", label: t("Students"), icon: "☺" },
    { href: "/admin/attendance", label: t("Attendance"), icon: "✓" },
    { href: "/admin/gamification", label: t("XP & badges"), icon: "★" },
    { href: "/admin/puzzles", label: t("Puzzles"), icon: "🧩" },
    { href: "/admin/tournaments", label: t("Tournaments"), icon: "♜" },
    ...(isAdmin
      ? [
          { href: "/admin/payments", label: t("Tuition payments"), icon: "💳" },
          { href: "/admin/plans", label: t("Price plans"), icon: "🏷" },
          { href: "/admin/inbox", label: t("Inbox"), icon: "✉" },
          { href: "/admin/shop", label: t("Shop"), icon: "🛍" },
          { href: "/admin/orders", label: t("Orders"), icon: "📦" },
          { href: "/admin/reports", label: t("Reports"), icon: "📈" },
          { href: "/admin/club", label: t("Club page & news"), icon: "🌐" },
          { href: "/admin/staff", label: t("Coaches & staff"), icon: "👤" },
          { href: "/admin/import", label: t("Import students"), icon: "⇪" },
          { href: "/admin/billing", label: t("Subscription"), icon: "⚙" },
        ]
      : []),
  ];
  const days = trialDaysLeft(club.trialEndsAt);
  return (
    <Shell title={club.name} sub={isAdmin ? t("Club admin") : t("Coach")} nav={nav} userName={user.name}>
      {isAdmin && club.billingStatus === "trial" && (
        <div className="mb-4 rounded-control bg-sky-50 px-4 py-2 text-sm text-sky-900">
          {t("Free trial: {n} days left.", { n: days })}
        </div>
      )}
      {children}
    </Shell>
  );
}
