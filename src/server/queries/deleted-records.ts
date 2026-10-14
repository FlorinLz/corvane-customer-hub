import { cache } from "react";

import type { Prisma } from "@prisma/client";

import { db } from "@/server/db";

// Brief 6.12.2, M16 AC12. Sorted by deleted-at newest first.
export const loadDeletedRecords = cache(async () => {
  const records = await db.entity.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: {
      bics: { select: { bic: true } },
      customerRole: { select: { active: true } },
      partnerRole: { select: { active: true } },
      deletedBy: { select: { name: true } },
    },
  });

  return Promise.all(
    records.map(async (e) => ({ ...e, reactivateBlockedMessage: e.lei ? await findLeiConflictMessage(e.lei, e.id) : null })),
  );
});

export type DeletedRecord = Awaited<ReturnType<typeof loadDeletedRecords>>[number];

/** Guard 5 (7.6.9 #5), the R1 substitute for M16 AC15: null when reactivation is clear, else the exact block message for the reused-LEI dialog panel. */
export async function findLeiConflictMessage(
  lei: string,
  excludeEntityId: string,
  /** Inside a transaction, pass its client: the pool holds one connection, so a query on `db` would wait for the connection the transaction itself holds. */
  client: Pick<Prisma.TransactionClient, "entity"> = db,
): Promise<string | null> {
  const conflict = await client.entity.findFirst({
    where: { lei, deletedAt: null, id: { not: excludeEntityId } },
    select: { legalName: true },
  });
  return conflict ? `${conflict.legalName} already uses this LEI. Reactivation with a reused LEI comes in a later release.` : null;
}
