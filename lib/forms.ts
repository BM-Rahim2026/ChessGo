"use server";
import { redirect } from "next/navigation";
import { db } from "./db";
import { sendEmail, appUrl } from "./email";

function s(fd: FormData, k: string, max = 200) {
  return String(fd.get(k) ?? "").trim().slice(0, max);
}

/** Public form handler for trial-lesson requests and registrations. */
export async function submitPublicForm(fd: FormData) {
  const slug = s(fd, "slug");
  const kind = s(fd, "kind") === "registration" ? "registration" : "trial";
  const rawBack = s(fd, "back");
  const back = /^\/(c|embed)\/[a-z0-9-]+(\/[a-z]+)?$/.test(rawBack) ? rawBack : `/c/${slug}`;
  const q = (k: string) => `${back}?${k}=1${back.startsWith("/embed/") && ["pl", "en"].includes(s(fd, "lang")) ? `&lang=${s(fd, "lang")}` : ""}`;
  const club = await db.club.findUnique({ where: { slug } });
  if (!club) redirect("/");
  if (s(fd, "website")) redirect(q("sent")); // honeypot: silently drop bots

  const email = s(fd, "parentEmail").toLowerCase();
  const required = [s(fd, "childFirst"), s(fd, "childLast"), s(fd, "parentFirst"), s(fd, "parentLast"), email];
  if (required.some((v) => !v) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || fd.get("consent") !== "on") {
    redirect(q("error"));
  }
  const recent = await db.formSubmission.count({ where: { clubId: club.id, parentEmail: email, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 5) redirect(q("sent"));

  const groupId = s(fd, "groupId");
  const group = groupId ? await db.group.findFirst({ where: { id: groupId, clubId: club.id } }) : null;
  const birth = s(fd, "childBirth");
  await db.formSubmission.create({
    data: {
      clubId: club.id, kind,
      childFirst: s(fd, "childFirst", 80), childLast: s(fd, "childLast", 80),
      childBirth: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? new Date(birth) : null,
      parentFirst: s(fd, "parentFirst", 80), parentLast: s(fd, "parentLast", 80), parentEmail: email, parentPhone: s(fd, "parentPhone", 40) || null,
      groupId: group?.id ?? null, preferredDate: s(fd, "preferredDate", 40) || null, message: s(fd, "message", 2000) || null, consent: true,
    },
  });
  if (club.email) {
    // Club notifications are sent in Polish (the product's default language).
    await sendEmail(club.email, `${kind === "trial" ? "Nowe zgłoszenie na zajęcia próbne" : "Nowy zapis"}: ${s(fd, "childFirst")} ${s(fd, "childLast")}`,
      `${s(fd, "parentFirst")} ${s(fd, "parentLast")} (${email}${s(fd, "parentPhone") ? ", " + s(fd, "parentPhone") : ""})\n` +
      `${group ? "Grupa: " + group.name + "\n" : ""}${s(fd, "message") ? "\n" + s(fd, "message", 2000) + "\n" : ""}\nOtwórz zgłoszenia: ${appUrl()}/admin/inbox\n`, email);
  }
  redirect(q("sent"));
}
