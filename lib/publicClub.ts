import "server-only";
import { notFound } from "next/navigation";
import { db } from "./db";

export async function publicClub(slug: string) {
  const club = await db.club.findUnique({
    where: { slug },
    include: {
      groups: {
        where: { isPublic: true }, orderBy: { name: "asc" },
        include: { coach: true, slots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }, _count: { select: { students: { where: { status: "active" } } } } },
      },
      users: { where: { role: { in: ["coach", "club_admin"] }, bio: { not: null } }, orderBy: { name: "asc" } },
      news: { where: { published: true }, orderBy: { publishedAt: "desc" }, take: 6 },
    },
  });
  if (!club || club.billingStatus === "suspended") notFound();
  const formGroups = club.groups.map((g) => ({ id: g.id, name: g.name, ageRange: g.ageRange, slots: g.slots, full: g._count.students >= g.capacity }));
  return { club, formGroups };
}

/** Club shown on the home page: FEATURED_CLUB_SLUG, otherwise the oldest active club. */
export async function featuredClub() {
  const slug = process.env.FEATURED_CLUB_SLUG?.trim();
  const pick = slug
    ? await db.club.findUnique({ where: { slug }, select: { slug: true, billingStatus: true } })
    : await db.club.findFirst({ where: { billingStatus: { not: "suspended" } }, orderBy: { createdAt: "asc" }, select: { slug: true, billingStatus: true } });
  if (!pick || pick.billingStatus === "suspended") return null;
  return (await publicClub(pick.slug)).club;
}
