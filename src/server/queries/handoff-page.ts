import { cache } from "react";

import { db } from "@/server/db";
import type { SalesToOpsSnapshot, OpsToCsSnapshot } from "@/server/services/handoff.types";

// Brief S6 "Handoff" screen (6.927): View A (Sales -> Ops summary,
// Confirm pickup), View B is the send form (not this route), View C
// (Ops -> CS summary, Accept). Already-resolved handoffs show the same
// read-only summary with no action (M3 AC17, M8 AC17).

export const loadHandoffPage = cache(async (handoffId: string) => {
  const handoff = await db.handoff.findUnique({
    where: { id: handoffId },
    include: {
      entity: { select: { id: true, legalName: true, country: true, deletedAt: true } },
      fromUser: { select: { id: true, name: true, team: true } },
      toUser: { select: { id: true, name: true, team: true } },
    },
  });
  if (!handoff) return null;

  return {
    id: handoff.id,
    type: handoff.type,
    status: handoff.status,
    entity: handoff.entity,
    fromUser: handoff.fromUser,
    toUser: handoff.toUser,
    sentAt: handoff.sentAt,
    confirmedAt: handoff.confirmedAt,
    acceptedAt: handoff.acceptedAt,
    version: handoff.version,
    snapshot: handoff.snapshot as unknown as SalesToOpsSnapshot | OpsToCsSnapshot,
  };
});

export type HandoffPageData = NonNullable<Awaited<ReturnType<typeof loadHandoffPage>>>;
