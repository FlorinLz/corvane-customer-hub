import { cache } from "react";

import { db } from "@/server/db";

export const PAGE_SIZE = 50;

/** Brief 6.10, M16 AC4-AC5. R1: newest first, 50/page, Load more. No Field/User/Date filters yet (R2). */
export const loadAuditPage = cache(async (entityId: string, page: number) => {
  const take = PAGE_SIZE * page;
  const [entries, total] = await Promise.all([
    db.auditEntry.findMany({
      where: { entityId },
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { name: true } } },
    }),
    db.auditEntry.count({ where: { entityId } }),
  ]);
  return { entries, total, hasMore: total > take };
});

export type AuditPageData = Awaited<ReturnType<typeof loadAuditPage>>;
