import type { Scheme, Stage, Team } from "@prisma/client";

import { db } from "@/server/db";
import { STAGE_ORDER } from "@/lib/labels";

/** From this stage a customer's product line is live: a failure on its scheme and country reaches them. */
export const LIVE_STAGE_INDEX = STAGE_ORDER.indexOf("LIVE_HYPERCARE");

export interface CoverageCustomer {
  entityId: string;
  entityName: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerTz: string | null;
  ownerTeam: Team | null;
  lines: { id: string; stage: Stage }[];
}

/**
 * The one rule for "which customers use this scheme and country": every active customer (not deleted, not inactive) with a product
 * line on it that is not cancelled, grouped by customer. "Affected customers" on a partner issue and "Customers on this coverage" on the
 * partner's page both start here, so the two lists always agree (tests/unit/coverage-customers.test.ts).
 */
export async function loadCoverageCustomers(scheme: Scheme, country: string): Promise<CoverageCustomer[]> {
  const lines = await db.contractedProduct.findMany({
    where: { product: scheme, country, cancelledAt: null, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" }, customerRole: { active: true } } },
    select: { id: true, stage: true, entityId: true, entity: { select: { id: true, legalName: true, ownerId: true, owner: { select: { id: true, name: true, timeZone: true, team: true } } } } },
  });
  const byEntity = new Map<string, CoverageCustomer>();
  for (const line of lines) {
    const existing = byEntity.get(line.entityId);
    if (existing) {
      existing.lines.push({ id: line.id, stage: line.stage });
    } else {
      byEntity.set(line.entityId, {
        entityId: line.entityId,
        entityName: line.entity.legalName,
        ownerId: line.entity.ownerId,
        ownerName: line.entity.owner?.name ?? null,
        ownerTz: line.entity.owner?.timeZone ?? null,
        ownerTeam: line.entity.owner?.team ?? null,
        lines: [{ id: line.id, stage: line.stage }],
      });
    }
  }
  return [...byEntity.values()];
}

export const isLive = (l: { stage: Stage }) => STAGE_ORDER.indexOf(l.stage) >= LIVE_STAGE_INDEX;

/** The customers a failure reaches now: at least one live line (the rest are "before go-live"). Sorted by name. */
export async function loadLiveCoverageCustomers(scheme: Scheme, country: string) {
  const all = await loadCoverageCustomers(scheme, country);
  return all
    .filter((c) => c.lines.some(isLive))
    .map((c) => ({ entityId: c.entityId, entityName: c.entityName, lines: c.lines.filter(isLive) }))
    .sort((a, b) => a.entityName.localeCompare(b.entityName));
}
