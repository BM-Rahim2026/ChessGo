import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Empty } from "@/components/ui";
import { fmtDate, str } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

async function create(fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff();
  const tour = await db.tournament.create({ data: { clubId, name: str(fd.get("name")), date: new Date(str(fd.get("date"))), rounds: Number(fd.get("rounds")) || 5 } });
  redirect(`/admin/tournaments/${tour.id}`);
}

export default async function Tournaments() {
  const t = await getT();
  const { clubId } = await requireStaff();
  const list = await db.tournament.findMany({ where: { clubId }, orderBy: { date: "desc" }, include: { _count: { select: { entries: true, games: true } } } });
  const winners = new Map((await db.student.findMany({ where: { id: { in: list.map((tour) => tour.winnerId).filter(Boolean) as string[] } } })).map((s) => [s.id, s]));
  return (
    <div>
      <PageHeader title={t("Tournaments")} sub={t("Games award XP to both players; finishing a tournament crowns the winner.")} />
      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? <div className="p-5"><Empty>{t("No tournaments yet.")}</Empty></div> : (
          <table className="table">
            <thead><tr><th>{t("Name")}</th><th>{t("Date")}</th><th>{t("Players")}</th><th>{t("Games")}</th><th>{t("Status")}</th><th>{t("Winner")}</th></tr></thead>
            <tbody>{list.map((tour) => (
              <tr key={tour.id}>
                <td><Link className="font-medium text-brand" href={`/admin/tournaments/${tour.id}`}>{tour.name}</Link></td>
                <td>{fmtDate(tour.date)}</td><td>{tour._count.entries}</td><td>{tour._count.games}</td><td><Pill v={tour.status} /></td>
                <td>{tour.winnerId ? `🏆 ${winners.get(tour.winnerId)?.firstName ?? ""}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <form action={create} className="card mt-6 flex flex-wrap items-end gap-3">
        <Field label={t("Name")} className="flex-1"><input className="input" name="name" required placeholder={t("Autumn Junior Open")} /></Field>
        <Field label={t("Date")}><input className="input" type="date" name="date" required /></Field>
        <Field label={t("Rounds")}><input className="input w-20" type="number" name="rounds" defaultValue={5} min={1} max={15} /></Field>
        <button className="btn">{t("Create")}</button>
      </form>
    </div>
  );
}
