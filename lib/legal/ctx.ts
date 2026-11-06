import "server-only";
import { featuredClub } from "@/lib/publicClub";
import type { LegalCtx } from "./terms";

/** Contact email: LEGAL_EMAIL, otherwise the featured club's email. */
export async function legalCtx(): Promise<LegalCtx> {
  const club = await featuredClub().catch(() => null);
  return { email: process.env.LEGAL_EMAIL?.trim() || club?.email || "kontakt@chessgo.pl", site: process.env.LEGAL_SITE?.trim() || "chessgo.pl" };
}
