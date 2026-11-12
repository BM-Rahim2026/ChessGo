import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { Logo } from "@/components/Brand";
import { registrationLink } from "@/lib/crm";
import { fmtDate } from "@/lib/format";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/** A4 flyer for the Open Day: school name, date, QR code to the school's registration link. Polish (for parents). */
export default async function Flyer({ params }: { params: Promise<{ id: string }> }) {
  const { clubId, club } = await requireStaff(true);
  const { id } = await params;
  const l = await db.schoolLead.findFirst({ where: { id, clubId } });
  if (!l) notFound();
  const link = registrationLink(club.slug, l.id);
  const qr = await QRCode.toString(link, { type: "svg", margin: 0, color: { dark: "#0B3D2E", light: "#FFFFFF" } });
  return (
    <div className="min-h-screen bg-white">
      <style>{`@page { size: A4; margin: 12mm; } @media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      <div className="no-print flex justify-center gap-2 bg-cream p-3"><PrintButton /></div>
      <main className="mx-auto flex max-w-[180mm] flex-col items-center px-6 py-8 text-center">
        <Logo width={260} />
        <p className="mt-2 font-display text-2xl font-semibold text-forest">Małe ruchy. Wielkie postępy.</p>
        <h1 className="mt-8 font-display text-5xl font-bold leading-tight text-forest">Szachy w {l.schoolName}!</h1>
        {l.openDayDate && (
          <p className="mt-4 rounded-full bg-go px-6 py-2 font-display text-2xl font-semibold text-forest">
            Dzień Otwarty: {fmtDate(new Date(`${l.openDayDate}T12:00:00Z`))}{l.openDayTime ? `, godz. ${l.openDayTime}` : ""}
          </p>
        )}
        <ul className="mt-8 space-y-2 text-left text-xl text-ink">
          <li>♟ Zajęcia szachowe dla dzieci na terenie szkoły</li>
          <li>★ Małe grupy i doświadczeni trenerzy</li>
          <li>🧩 Codzienne zadania, odznaki i turnieje w aplikacji ChessGo</li>
          <li>🎓 Koncentracja, logiczne myślenie i dobra zabawa</li>
        </ul>
        <div className="mt-10 rounded-learner border-4 border-forest p-5">
          <div className="h-56 w-56" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
        <p className="mt-4 font-display text-2xl font-semibold text-forest">Zeskanuj kod i zapisz dziecko</p>
        <p className="mt-1 break-all text-sm text-ink-soft">{link}</p>
        <p className="mt-10 text-base text-ink">{club.name}{club.phone ? ` · ${club.phone}` : ""} · {process.env.CONTACT_EMAIL || club.email || "kontakt@chessgo.pl"} · chessgo.pl</p>
      </main>
    </div>
  );
}
