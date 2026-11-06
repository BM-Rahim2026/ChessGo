import "server-only";
import { db } from "./db";
import { findOrCreateParent } from "./people";

/**
 * Turn a trial/registration submission into Student + Parent records in one step.
 * Reuses an existing parent with the same email (siblings), links them, and marks the submission converted.
 */
export async function convertSubmission(clubId: string, submissionId: string, groupId?: string | null) {
  const sub = await db.formSubmission.findFirst({ where: { id: submissionId, clubId } });
  if (!sub) throw new Error("Submission not found");
  if (sub.status === "converted" && sub.convertedStudentId) return sub.convertedStudentId;
  const gid = groupId ?? sub.groupId;
  const group = gid ? await db.group.findFirst({ where: { id: gid, clubId } }) : null;

  const parent = await findOrCreateParent(clubId, {
    firstName: sub.parentFirst, lastName: sub.parentLast, email: sub.parentEmail, phone: sub.parentPhone,
  });
  const dup = await db.student.findFirst({
    where: { clubId, firstName: sub.childFirst, lastName: sub.childLast, parents: { some: { parentId: parent.id } } },
  });
  const student = dup ?? (await db.student.create({
    data: {
      clubId, firstName: sub.childFirst, lastName: sub.childLast, birthDate: sub.childBirth, groupId: group?.id ?? null,
      notes: [sub.kind === "trial" ? "From trial lesson request" : "From online registration", sub.message].filter(Boolean).join(" — "),
    },
  }));
  if (dup && group && !dup.groupId) await db.student.update({ where: { id: dup.id }, data: { groupId: group.id, status: "active", leftAt: null } });
  await db.studentParent.upsert({
    where: { studentId_parentId: { studentId: student.id, parentId: parent.id } }, update: {}, create: { studentId: student.id, parentId: parent.id },
  });
  await db.formSubmission.update({ where: { id: sub.id }, data: { status: "converted", convertedStudentId: student.id } });
  return student.id;
}
