import type { LifecycleState, Prisma } from "@prisma/client";

import { toLocalDate, today } from "@/lib/dates";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { computeLifecycle } from "@/server/derived/lifecycle";

/**
 * Brief 3.2.4 "Lifecycle state" / decision B1: recomputed after every
 * product, coverage and role write. Re-reads the entity's current facts
 * inside the caller's transaction and updates `Entity.lifecycleState` when
 * it changed. Returns the (possibly unchanged) state.
 */
export async function recomputeLifecycle(tx: Prisma.TransactionClient, entityId: string): Promise<LifecycleState> {
  const entity = await tx.entity.findUniqueOrThrow({
    where: { id: entityId },
    include: {
      products: { where: { cancelledAt: null }, select: { stage: true } },
      partnerRole: {
        select: {
          active: true,
          coverage: { select: { statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } } } },
        },
      },
    },
  });

  const todayLocal = today();
  const partnerHasActiveOrDegradedCoverage =
    entity.partnerRole?.coverage.some((row) => {
      const status = computeCoverageStatus(
        row.statusChanges.map((c) => ({ status: c.status, effectiveDate: toLocalDate(c.effectiveDate), createdAt: c.createdAt })),
        todayLocal,
      ).current?.status;
      return status === "ACTIVE" || status === "DEGRADED";
    }) ?? false;

  const next = computeLifecycle({
    isInactive: entity.lifecycleState === "INACTIVE",
    activeProductStages: entity.products.map((p) => p.stage),
    hasActivePartnerRole: entity.partnerRole?.active ?? false,
    partnerHasActiveOrDegradedCoverage,
  });

  if (next !== entity.lifecycleState) {
    await tx.entity.update({ where: { id: entityId }, data: { lifecycleState: next } });
  }
  return next;
}
