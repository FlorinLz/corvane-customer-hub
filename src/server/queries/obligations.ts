import type { Prisma, Scheme, SchemeAdherence } from "@prisma/client";

import { db } from "@/server/db";
import { normaliseSearch } from "@/lib/validation/normalise";

export const PAGE_SIZE = 25;

export type ObligationsSort = "sp_desc" | "sp_asc" | "in_asc" | "in_desc";

export interface ObligationsFilters {
  q?: string;
  countries: string[];
  schemes: Scheme[];
  incMin?: number;
  incMax?: number;
  sort: ObligationsSort;
  page: number;
}

export interface ObligationRow {
  entityId: string;
  legalName: string;
  country: string | null;
  incidentNoticeHours: number | null;
  subprocessorNoticeDays: number | null;
  auditRight: boolean | null;
  availabilitySlaPct: number | null;
  euVopStatus: SchemeAdherence | null;
  ukCopStatus: SchemeAdherence | null;
  expiryDate: Date | null;
  contractUrl: string | null;
}

export async function runObligationsSearch(filters: ObligationsFilters): Promise<{ rows: ObligationRow[]; total: number }> {
  const qn = normaliseSearch((filters.q ?? "").trim());
  const hasQuery = qn.length >= 2;

  const where: Prisma.EntityWhereInput = {
    deletedAt: null,
    lifecycleState: { in: ["ONBOARDING", "LIVE", "BAU"] },
    customerRole: { active: true },
  };

  if (hasQuery) {
    where.OR = [{ legalNameSearch: { contains: qn } }, { aliases: { some: { aliasSearch: { contains: qn } } } }];
  }

  if (filters.countries.length > 0) {
    where.products = { some: { cancelledAt: null, country: { in: filters.countries } } };
  }

  const schemeConditions: Prisma.ObligationCardWhereInput[] = [];
  if (filters.schemes.includes("EU_VOP")) schemeConditions.push({ AND: [{ euVopStatus: { not: null } }, { euVopStatus: { not: "NOT_APPLICABLE" } }] });
  if (filters.schemes.includes("UK_COP")) schemeConditions.push({ AND: [{ ukCopStatus: { not: null } }, { ukCopStatus: { not: "NOT_APPLICABLE" } }] });
  // GLOBAL_VALIDATION has no obligation-card field: selecting only it matches nothing in this view.

  const obligationCardFilter: Prisma.EntityWhereInput["obligationCards"] =
    filters.schemes.length > 0
      ? { some: { kind: "CUSTOMER_AGREEMENT", OR: schemeConditions.length > 0 ? schemeConditions : [{ id: "never-matches" }] } }
      : undefined;

  if (filters.incMin !== undefined || filters.incMax !== undefined) {
    where.obligationCards = {
      some: {
        kind: "CUSTOMER_AGREEMENT",
        incidentNoticeHours: {
          not: null,
          ...(filters.incMin !== undefined ? { gte: filters.incMin } : {}),
          ...(filters.incMax !== undefined ? { lte: filters.incMax } : {}),
        },
      },
    };
  }

  if (obligationCardFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { obligationCards: obligationCardFilter }];
  }

  const [entities, total] = await Promise.all([
    db.entity.findMany({
      where,
      include: { obligationCards: { where: { kind: "CUSTOMER_AGREEMENT" } } },
    }),
    db.entity.count({ where }),
  ]);

  const rows: ObligationRow[] = entities.map((e) => {
    const card = e.obligationCards[0] ?? null;
    return {
      entityId: e.id,
      legalName: e.legalName,
      country: e.country,
      incidentNoticeHours: card?.incidentNoticeHours ?? null,
      subprocessorNoticeDays: card?.subprocessorNoticeDays ?? null,
      auditRight: card?.auditRight ?? null,
      availabilitySlaPct: card?.availabilitySlaPct ? Number(card.availabilitySlaPct) : null,
      euVopStatus: card?.euVopStatus ?? null,
      ukCopStatus: card?.ukCopStatus ?? null,
      expiryDate: card?.expiryDate ?? null,
      contractUrl: card?.contractUrl ?? null,
    };
  });

  const sortKey = filters.sort === "sp_desc" || filters.sort === "sp_asc" ? "subprocessorNoticeDays" : "incidentNoticeHours";
  const ascending = filters.sort === "sp_asc" || filters.sort === "in_asc";
  rows.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return a.legalName.localeCompare(b.legalName);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return ascending ? av - bv : bv - av;
    return a.legalName.localeCompare(b.legalName);
  });

  const start = (filters.page - 1) * PAGE_SIZE;
  return { rows: rows.slice(start, start + PAGE_SIZE), total };
}
