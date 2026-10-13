import { cache } from "react";

import { db } from "@/server/db";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadProductsData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const products = await db.contractedProduct.findMany({
    where: { entityId: id },
    include: { contractingEntity: { select: { legalName: true } } },
    orderBy: { targetGoLive: "asc" },
  });

  return { entity, products };
});

export type ProductsData = NonNullable<Awaited<ReturnType<typeof loadProductsData>>>;
