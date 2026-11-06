import { requireStaff } from "@/lib/auth";
import { Shell, type NavItem } from "@/components/Shell";
import { trialDaysLeft } from "@/lib/billing";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, club } = await requireStaff();
  const isAdmin = user.role === "club_admin";
  const nav: NavItem[] = [
    { href: "/admin", label: "Dashboard", icon: "▦" },
    { href: "/admin/groups", label: "Groups & schedule", icon: "◫" },
    { href: "/admin/students", label: "Students", icon: "☺" },
    { href: "/admin/attendance", label: "Attendance", icon: "✓" },
    { href: "/admin/gamification", label: "XP & badges", icon: "★" },
    { href: "/admin/puzzles", label: "Puzzles", icon: "🧩" },
    { href: "/admin/tournaments", label: "Tournaments", icon: "♜" },
    ...(isAdmin
      ? [
          { href: "/admin/payments", label: "Tuition payments", icon: "💳" },
          { href: "/admin/inbox", label: "Inbox", icon: "✉" },
          { href: "/admin/shop", label: "Shop", icon: "🛍" },
          { href: "/admin/orders", label: "Orders", icon: "📦" },
          { href: "/admin/reports", label: "Reports", icon: "📈" },
          { href: "/admin/club", label: "Club page & news", icon: "🌐" },
          { href: "/admin/staff", label: "Coaches & staff", icon: "👤" },
          { href: "/admin/import", label: "Import students", icon: "⇪" },
          { href: "/admin/billing", label: "Subscription", icon: "⚙" },
        ]
      : []),
  ];
  const days = trialDaysLeft(club.trialEndsAt);
  return (
    <Shell title={club.name} sub={isAdmin ? "Club admin" : "Coach"} nav={nav} userName={user.name}>
      {isAdmin && club.billingStatus === "trial" && (
        <div className="mb-4 rounded-control bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Free trial: {days} day{days === 1 ? "" : "s"} left.
        </div>
      )}
      {children}
    </Shell>
  );
}
