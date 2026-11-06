import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Field, Pill, Empty } from "@/components/ui";
import { fmtDate, str } from "@/lib/format";

async function create(fd: FormData) {
  "use server";
  const { clubId } = await requireStaff();
  const t = await db.tournament.create({ data: { clubId, name: str(fd.get("name")), date: new Date(str(fd.get("date"))), rounds: Number(fd.get("rounds")) || 5 } });
  redirect(`/admin/tournaments/${t.id}`);
}

export default async function Tournaments() {
  const { clubId } = await requireStaff();
  const list = await db.tournament.findMany({ where: { clubId }, orderBy: { date: "desc" }, include: { _count: { select: { entries: true, games: true } } } });
  const winners = new Map((await db.student.findMany({ where: { id: { in: list.map((t) => t.winnerId).filter(Boolean) as string[] } } })).map((s) => [s.id, s]));
  return (
    <div>
      <PageHeader title="Tournaments" sub="Games award XP to both players; finishing a tournament crowns the winner." />
      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? <div className="p-5"><Empty>No tournaments yet.</Empty></div> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Date</th><th>Players</th><th>Games</th><th>Status</th><th>Winner</th></tr></thead>
            <tbody>{list.map((t) => (
              <tr key={t.id}>
                <td><Link className="font-medium text-brand" href={`/admin/tournaments/${t.id}`}>{t.name}</Link></td>
                <td>{fmtDate(t.date)}</td><td>{t._count.entries}</td><td>{t._count.games}</td><td><Pill v={t.status} /></td>
                <td>{t.winnerId ? `🏆 ${winners.get(t.winnerId)?.firstName ?? ""}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <form action={create} className="card mt-6 flex flex-wrap items-end gap-3">
        <Field label="Name" className="flex-1"><input className="input" name="name" required placeholder="Autumn Junior Open" /></Field>
        <Field label="Date"><input className="input" type="date" name="date" required /></Field>
        <Field label="Rounds"><input className="input w-20" type="number" name="rounds" defaultValue={5} min={1} max={15} /></Field>
        <button className="btn">Create</button>
      </form>
    </div>
  );
}
