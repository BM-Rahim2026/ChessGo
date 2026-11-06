import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { runImport } from "@/lib/importRun";
import { FIELDS, type Mapping } from "@/lib/importer";
import { ImportClient } from "./ImportClient";
import { getT, getLocale } from "@/lib/i18n/server";

async function doImport(_p: unknown, fd: FormData) {
  "use server";
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const csv = String(fd.get("csv") ?? "");
  if (!csv) return { ok: false as const, message: t("No file.") };
  if (csv.length > 3_000_000) return { ok: false as const, message: t("File too large (max 3 MB). Split it into parts.") };
  let mapping: Mapping = {};
  try {
    const raw = JSON.parse(String(fd.get("mapping") ?? "{}"));
    for (const k of Object.keys(FIELDS)) if (Number.isInteger(raw[k])) mapping[k as keyof Mapping] = raw[k];
  } catch {
    mapping = {};
  }
  const def = String(fd.get("defaultGroupId") ?? "");
  const defaultGroupId = def && (await db.group.findFirst({ where: { id: def, clubId } })) ? def : null;
  const summary = await runImport(clubId, csv, mapping, { createGroups: fd.get("createGroups") === "on", defaultGroupId });
  revalidatePath("/admin/students");
  return { ok: true as const, summary };
}

export default async function ImportPage() {
  const t = await getT();
  const { clubId } = await requireStaff(true);
  const groups = await db.group.findMany({ where: { clubId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title={t("Import students")} sub={t("Bring your students and parents over from SportBM or a spreadsheet. Existing students are skipped, so you can import again safely.")} />
      <ImportClient action={doImport} groups={groups} locale={await getLocale()} />
    </div>
  );
}
