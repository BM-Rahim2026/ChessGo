import { Shell } from "@/components/Shell";
import { portalContext } from "@/lib/portal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, club } = await portalContext();
  const nav = user.role === "student"
    ? [{ href: "/portal", label: "My progress", icon: "★" }, { href: "/portal/puzzle", label: "Daily puzzle", icon: "🧩" }]
    : [{ href: "/portal", label: "My children", icon: "☺" }, { href: "/portal/shop", label: "Club shop", icon: "🛍" }, { href: "/portal/orders", label: "My orders", icon: "📦" }];
  return <Shell title={club.name} sub={user.role === "student" ? "Student" : "Parent"} nav={nav} userName={user.name}>{children}</Shell>;
}
