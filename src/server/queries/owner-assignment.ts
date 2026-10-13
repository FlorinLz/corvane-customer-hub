import { cache } from "react";

import { db } from "@/server/db";

/** Brief 4.5 Owner assignment dialog: new-owner picker, active CS/Ops/Sales users, CS group first. */
export const loadOwnerCandidates = cache(async () => {
  const users = await db.user.findMany({
    where: { active: true, team: { in: ["CS", "OPS", "SALES"] } },
    select: { id: true, name: true, team: true },
    orderBy: { name: "asc" },
  });
  const order: Record<string, number> = { CS: 0, OPS: 1, SALES: 2 };
  return users.sort((a, b) => order[a.team] - order[b.team]);
});

/**
 * Brief 4.5: the header's owner-assignment banner / "Acknowledge" surface
 * — shown only to the assignee of an unacknowledged, unsuperseded
 * assignment on this entity (milestone 11's Home worklist isn't built
 * yet, so the header is the only entry point this milestone).
 */
export const loadMyUnacknowledgedAssignment = cache(async (entityId: string, userId: string) => {
  return db.ownerAssignment.findFirst({
    where: { entityId, assigneeId: userId, acknowledgedAt: null, supersededAt: null },
    include: { assignedBy: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });
});
