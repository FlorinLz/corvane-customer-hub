import { cache } from "react";

import { db } from "@/server/db";
import { toLocalDate, today as todayFn } from "@/lib/dates";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadPartnerData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity || !entity.partnerRole?.active) return null;

  const partnerRole = await db.partnerRole.findUnique({
    where: { entityId: id },
    include: {
      coverage: {
        include: {
          statusChanges: {
            include: { user: { select: { name: true } } },
            orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          },
        },
        orderBy: [{ scheme: "asc" }, { country: "asc" }],
      },
    },
  });

  const today = todayFn();

  const coverageRows = (partnerRole?.coverage ?? []).map((row) => {
    const past = row.statusChanges.filter((c) => toLocalDate(c.effectiveDate) <= today);
    const future = row.statusChanges.filter((c) => toLocalDate(c.effectiveDate) > today);
    const current = past[0] ?? null; // already sorted desc by effectiveDate, createdAt
    const scheduled = future.length > 0 ? future[future.length - 1] : null; // earliest future
    return { ...row, current, scheduled };
  });

  const counts: Record<string, number> = {};
  for (const row of coverageRows) {
    if (row.current) counts[row.current.status] = (counts[row.current.status] ?? 0) + 1;
  }

  return { entity, partnerRole, coverageRows, counts };
});

export type PartnerData = NonNullable<Awaited<ReturnType<typeof loadPartnerData>>>;
