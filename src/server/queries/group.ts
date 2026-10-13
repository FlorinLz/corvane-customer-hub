import { cache } from "react";

import { db } from "@/server/db";
import { STAGE_ORDER } from "@/lib/labels";

export const loadGroupData = cache(async (id: string) => {
  const group = await db.group.findUnique({ where: { id } });
  if (!group) return null;

  const [entities, contracts] = await Promise.all([
    db.entity.findMany({
      where: { groupId: id, deletedAt: null },
      include: {
        bics: true,
        customerRole: { include: { contract: { include: { invoicedEntity: { select: { legalName: true } } } } } },
        partnerRole: true,
        products: { where: { cancelledAt: null }, orderBy: { targetGoLive: "asc" } },
      },
      orderBy: { legalName: "asc" },
    }),
    db.contract.findMany({
      where: { groupId: id },
      include: { invoicedEntity: { select: { legalName: true } }, customerRoles: { include: { entity: { select: { legalName: true } } } } },
    }),
  ]);

  const customerCount = entities.filter((e) => e.customerRole?.active).length;
  const partnerCount = entities.filter((e) => e.partnerRole?.active).length;
  const bothCount = entities.filter((e) => e.customerRole?.active && e.partnerRole?.active).length;
  const noContractCount = entities.filter((e) => e.customerRole?.active && !e.customerRole.contractId).length;
  const countries = [...new Set(entities.map((e) => e.country).filter((c): c is string => c !== null))].sort();

  const stageCounts: Record<string, number> = {};
  for (const e of entities) {
    for (const p of e.products) {
      stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
    }
  }
  const stageList = STAGE_ORDER.filter((s) => stageCounts[s] > 0).map((s) => ({ stage: s, count: stageCounts[s] }));

  return {
    group,
    entities,
    contracts,
    tiles: { entityCount: entities.length, customerCount, partnerCount, bothCount, noContractCount, countries, stageList },
  };
});

export type GroupData = NonNullable<Awaited<ReturnType<typeof loadGroupData>>>;

/** Brief 3.8.2 "Set group" (Link entity dialog): the picker lists every group by name. */
export const loadGroupOptions = cache(async () => {
  return db.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
});
