import "server-only";
import { db } from "./db";
import { parseCsv, normalizeRows, type Mapping, type Msg } from "./importer";
import { findOrCreateParent } from "./people";

export type ImportSummary = { created: number; skipped: number; failed: number; groupsCreated: string[]; parentsLinked: number; details: Msg[] };

export async function runImport(clubId: string, csv: string, mapping: Mapping, opts: { createGroups: boolean; defaultGroupId: string | null }): Promise<ImportSummary> {
  const rows = normalizeRows(parseCsv(csv), mapping);
  const groups = await db.group.findMany({ where: { clubId } });
  const byName = new Map(groups.map((g) => [g.name.toLowerCase().trim(), g.id]));
  const out: ImportSummary = { created: 0, skipped: 0, failed: 0, groupsCreated: [], parentsLinked: 0, details: [] };

  for (const r of rows) {
    if (r.errors.length) { out.failed++; for (const e of r.errors) out.details.push({ m: "Line {line}: " + e.m, v: { line: r.line, ...e.v } }); continue; }

    let groupId: string | null = opts.defaultGroupId;
    if (r.group) {
      const key = r.group.toLowerCase().trim();
      if (!byName.has(key) && opts.createGroups) {
        const g = await db.group.create({ data: { clubId, name: r.group.trim() } });
        byName.set(key, g.id); out.groupsCreated.push(g.name);
      }
      groupId = byName.get(key) ?? opts.defaultGroupId;
    }

    // Duplicate check: same name and (same birth date, or same parent email, or neither known)
    const candidates = await db.student.findMany({
      where: { clubId, firstName: { equals: r.studentFirst, mode: "insensitive" }, lastName: { equals: r.studentLast, mode: "insensitive" } },
      include: { parents: { include: { parent: true } } },
    });
    const dup = candidates.find((c) =>
      (r.birthDate && c.birthDate?.toISOString().slice(0, 10) === r.birthDate) ||
      (r.parentEmail && c.parents.some((p) => p.parent.email === r.parentEmail)) ||
      (!r.birthDate && !r.parentEmail));
    if (dup) { out.skipped++; out.details.push({ m: "Line {line}: {name} already exists, skipped", v: { line: r.line, name: `${r.studentFirst} ${r.studentLast}` } }); continue; }

    const joined = r.joinedAt ? new Date(r.joinedAt + "T12:00:00Z") : new Date();
    const s = await db.student.create({
      data: {
        clubId, firstName: r.studentFirst, lastName: r.studentLast, groupId,
        birthDate: r.birthDate ? new Date(r.birthDate + "T12:00:00Z") : null,
        status: r.active ? "active" : "inactive", joinedAt: joined, leftAt: r.active ? null : new Date(),
        notes: [r.notes, "Imported from CSV"].filter(Boolean).join(" — "),
      },
    });
    out.created++;
    if (r.parentEmail) {
      const p = await findOrCreateParent(clubId, { firstName: r.parentFirst, lastName: r.parentLast, email: r.parentEmail, phone: r.parentPhone });
      await db.studentParent.create({ data: { studentId: s.id, parentId: p.id } });
      out.parentsLinked++;
    }
  }
  return out;
}
