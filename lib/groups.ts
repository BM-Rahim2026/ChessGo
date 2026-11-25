import type { Prisma } from "@prisma/client";

/** Students who belong to a group: main group or extra group. */
export function inGroup(groupId: string): Prisma.StudentWhereInput {
  return { OR: [{ groupId }, { extraGroups: { some: { groupId } } }] };
}
