import { cache } from "react";

import { db } from "@/server/db";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadComplianceData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const [kybChecks, periodicReview, customerAgreement] = await Promise.all([
    db.kybCheck.findMany({ where: { entityId: id }, include: { verifiedBy: { select: { name: true } } } }),
    db.periodicReview.findUnique({ where: { entityId: id } }),
    entity.customerRole?.active
      ? db.obligationCard.findUnique({ where: { entityId_kind: { entityId: id, kind: "CUSTOMER_AGREEMENT" } }, include: { updatedBy: { select: { name: true, team: true } } } })
      : null,
  ]);

  const kybByType = Object.fromEntries(kybChecks.map((k) => [k.type, k]));

  return { entity, kybByType, periodicReview, customerAgreement };
});

export type ComplianceData = NonNullable<Awaited<ReturnType<typeof loadComplianceData>>>;
