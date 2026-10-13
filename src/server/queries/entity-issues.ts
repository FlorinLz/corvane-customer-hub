import { cache } from "react";

import { db } from "@/server/db";
import { now as nowFn } from "@/lib/dates";
import { loadEntityCore } from "@/server/queries/entity-core";
import { effectiveCommunicator } from "@/server/derived/communicator";

// Brief M17 screens, the entity Issues tab.

/**
 * PO decision (see DECISIONS.md, same rule as the Home "Issues" section):
 * once an issue is Resolved, only its effective communicator still has
 * work to do here (close with the customer) -- everyone else sees it in
 * `resolvedWaiting` instead of `issues`, a collapsed group at the bottom
 * of the tab rather than mixed into the main table. This tab has no
 * per-viewer "my role" concept otherwise (every team sees the same table),
 * so the split is simply "is the viewer the communicator" -- there's no
 * separate owner/contributor distinction to preserve here the way Home's
 * worklist has one.
 */
export const loadEntityIssues = cache(async (entityId: string, status: "open" | "all", viewerId: string) => {
  const entity = await loadEntityCore(entityId);
  if (!entity) return null;

  const now = nowFn();
  const allIssues = await db.issue.findMany({
    where: { entityId, ...(status === "open" ? { status: { not: "CLOSED" } } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { name: true, team: true } },
      // This issue as a CHILD of a partner issue (M23, 6C): "Linked to ISS-<n>" on its row.
      parentLinks: { where: { unlinkedAt: null }, include: { parent: { select: { number: true } } } },
    },
  });

  const issues = allIssues.filter((i) => i.status !== "RESOLVED" || effectiveCommunicator(i, { ownerId: entity.owner?.id ?? null }, now) === viewerId);
  const resolvedWaiting = allIssues.filter((i) => i.status === "RESOLVED" && effectiveCommunicator(i, { ownerId: entity.owner?.id ?? null }, now) !== viewerId);

  return { entity, issues, resolvedWaiting };
});

export type EntityIssuesData = NonNullable<Awaited<ReturnType<typeof loadEntityIssues>>>;
