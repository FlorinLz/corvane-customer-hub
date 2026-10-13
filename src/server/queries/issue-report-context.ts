import { cache } from "react";

import { db } from "@/server/db";
import { today } from "@/lib/dates";
import { loadEntityCore } from "@/server/queries/entity-core";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { SCHEME_LABELS, STAGE_LABELS } from "@/lib/labels";

// Brief M17 AC2, AC7-AC9, edge case 1. Report-drawer context for a
// single entity: product lines, the customer-reporter contact picker,
// and (partner-only entities) the coverage rows that stand in for
// product lines when choosing scheme and country.

export const loadIssueReportContext = cache(async (entityId: string) => {
  const entity = await loadEntityCore(entityId);
  if (!entity) return null;

  const isPartnerOnly = (entity.partnerRole?.active ?? false) && !(entity.customerRole?.active ?? false);

  const [products, contacts, coverageRows] = await Promise.all([
    entity.customerRole?.active
      ? db.contractedProduct.findMany({
          where: { entityId, cancelledAt: null },
          select: { id: true, product: true, country: true, stage: true },
          orderBy: [{ product: "asc" }, { country: "asc" }],
        })
      : Promise.resolve([]),
    db.contact.findMany({
      where: { entityId, status: "ACTIVE", context: "CUSTOMER" },
      select: { id: true, fullName: true, role: true },
      orderBy: [{ isPrimary: "desc" }, { fullName: "asc" }],
    }),
    entity.partnerRole?.active
      ? db.partnerCoverage.findMany({
          where: { partnerRole: { entityId } },
          select: { scheme: true, country: true, statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } } },
        })
      : Promise.resolve([]),
  ]);

  const t = today();
  // The partner's coverages (its Partner tab) that are not retired, with their current status: "Partner coverage affected" lists them.
  const partnerCoverages = coverageRows
    .map((row) => ({
      scheme: row.scheme,
      country: row.country,
      status: computeCoverageStatus(
        row.statusChanges.map((c) => ({ status: c.status, effectiveDate: c.effectiveDate.toISOString().slice(0, 10), createdAt: c.createdAt })),
        t,
      ).current?.status,
    }))
    .filter((row) => row.status !== undefined && row.status !== "RETIRED")
    .map((row) => ({ scheme: row.scheme, country: row.country, status: row.status as string }));
  const openCoverageRows = isPartnerOnly ? partnerCoverages.map(({ scheme, country }) => ({ scheme, country })) : [];

  return {
    entity,
    customerRoleActive: entity.customerRole?.active ?? false,
    isPartnerOnly,
    productLines: products.map((p) => ({ id: p.id, scheme: p.product, country: p.country, stage: p.stage, label: `${SCHEME_LABELS[p.product]} / ${p.country}, ${STAGE_LABELS[p.stage]}` })),
    contacts,
    coverageRows: openCoverageRows,
    partnerCoverages,
    registeredCountry: entity.country ?? null,
  };
});

export type IssueReportContext = NonNullable<Awaited<ReturnType<typeof loadIssueReportContext>>>;
