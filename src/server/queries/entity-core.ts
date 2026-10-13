import { cache } from "react";

import { db } from "@/server/db";

/**
 * The fields almost every entity-record query needs: role flags, group,
 * owner, soft-delete marker. `cache()` dedupes this within one request, so
 * the layout (header) and a tab page calling it both hit the database
 * once (brief 3.1.2 "Sections load independently" without the cost of
 * duplicate round trips for the shared basics).
 */
export const loadEntityCore = cache(async (id: string) => {
  return db.entity.findUnique({
    where: { id },
    include: {
      group: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, team: true, active: true } },
      createdBy: { select: { id: true, name: true, team: true } },
      deletedBy: { select: { id: true, name: true } },
      customerRole: { select: { id: true, active: true, contractId: true, version: true } },
      partnerRole: { select: { id: true, active: true } },
      aliases: true,
      bics: true,
    },
  });
});

export type EntityCore = NonNullable<Awaited<ReturnType<typeof loadEntityCore>>>;
