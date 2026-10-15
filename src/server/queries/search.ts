import type { LeiStatus, LifecycleState, EntityType, Team, Scheme } from "@prisma/client";

import { db } from "@/server/db";
import { withSearchPath } from "@/server/sql";
import { today } from "@/lib/dates";
import { normaliseSearch } from "@/lib/validation/normalise";

export const PAGE_SIZE = 25;

export interface SearchFilters {
  q?: string;
  countries: string[];
  schemes: Scheme[];
  page: number;
}

export interface SearchResultRow {
  id: string;
  legalName: string;
  matchedAlias: string | null;
  type: EntityType | null;
  country: string | null;
  lei: string | null;
  leiStatus: LeiStatus | null;
  hasCustomerRole: boolean;
  hasPartnerRole: boolean;
  groupId: string | null;
  groupName: string | null;
  ownerName: string | null;
  ownerTeam: Team | null;
  lifecycleState: LifecycleState;
  prodMatch: boolean;
  covMatch: boolean;
  coverageChipText: string | null;
  noActiveIncidentContact: boolean;
}

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function runSearch(filters: SearchFilters): Promise<{ rows: SearchResultRow[]; total: number }> {
  const rawQ = (filters.q ?? "").trim();
  const qn = normaliseSearch(rawQ);
  const qc = rawQ.replace(/\s+/g, "").toUpperCase();
  const hasQuery = qn.length >= 2;
  const qnLike = `%${escapeLike(qn)}%`;
  const hasCountryOrScheme = filters.countries.length > 0 || filters.schemes.length > 0;
  const todayStr = today();

  const idRows = await withSearchPath(db, (tx) => tx.$queryRaw<
    { id: string; rank: number | null; matched_alias: string | null; prod_match: boolean; cov_match: boolean; coverage_chip: string | null; total: bigint }[]
  >`
    WITH matched AS (
      SELECT
        e.id,
        e."legalName" AS legal_name,
        LEAST(
          CASE WHEN e.lei = ${qc} AND length(${qc}) = 20 THEN 1 END,
          CASE WHEN EXISTS (SELECT 1 FROM "EntityBic" b WHERE b."entityId" = e.id AND (b.bic = ${qc} OR b.bic8 = ${qc})) THEN 1 END,
          CASE WHEN e."legalNameSearch" = ${qn} THEN 2 END,
          CASE WHEN EXISTS (SELECT 1 FROM "EntityAlias" a WHERE a."entityId" = e.id AND a."aliasSearch" = ${qn}) THEN 2 END,
          CASE WHEN e."legalNameSearch" LIKE ${qnLike} THEN 3 END,
          CASE WHEN EXISTS (SELECT 1 FROM "EntityAlias" a WHERE a."entityId" = e.id AND a."aliasSearch" LIKE ${qnLike}) THEN 3 END,
          CASE WHEN length(${qc}) >= 4 AND e.lei LIKE ${qc} || '%' THEN 3 END
        ) AS rank,
        (
          SELECT a.alias FROM "EntityAlias" a
          WHERE a."entityId" = e.id AND (a."aliasSearch" = ${qn} OR a."aliasSearch" LIKE ${qnLike})
          ORDER BY (a."aliasSearch" = ${qn}) DESC, a.alias ASC
          LIMIT 1
        ) AS matched_alias,
        EXISTS (
          SELECT 1 FROM "CustomerRole" cr
          JOIN "ContractedProduct" p ON p."entityId" = e.id AND p."cancelledAt" IS NULL
          WHERE cr."entityId" = e.id AND cr.active
            AND (cardinality(${filters.countries}::text[]) = 0 OR p.country = ANY(${filters.countries}::text[]))
            AND (cardinality(${filters.schemes}::text[]) = 0 OR p.product = ANY(${filters.schemes}::text[]::"Scheme"[]))
        ) AS prod_match,
        EXISTS (
          SELECT 1 FROM "PartnerRole" pr
          JOIN "PartnerCoverage" c ON c."partnerRoleId" = pr.id
          JOIN LATERAL (
            SELECT s.status FROM "CoverageStatusChange" s
            WHERE s."coverageId" = c.id AND s."effectiveDate" <= ${todayStr}::date
            ORDER BY s."effectiveDate" DESC, s."createdAt" DESC LIMIT 1
          ) cur ON true
          WHERE pr."entityId" = e.id AND pr.active
            AND (cardinality(${filters.countries}::text[]) = 0 OR c.country = ANY(${filters.countries}::text[]))
            AND (cardinality(${filters.schemes}::text[]) = 0 OR c.scheme = ANY(${filters.schemes}::text[]::"Scheme"[]))
            AND cur.status <> 'RETIRED'
        ) AS cov_match,
        (
          SELECT c.country || ' / ' ||
            (CASE c.scheme WHEN 'EU_VOP' THEN 'EU VoP' WHEN 'UK_COP' THEN 'UK CoP' ELSE 'Global validation' END)
            || ' ' ||
            (CASE cur.status WHEN 'ONBOARDING' THEN 'Onboarding' WHEN 'ACTIVE' THEN 'Active' WHEN 'DEGRADED' THEN 'Degraded' WHEN 'SUSPENDED' THEN 'Suspended' ELSE 'Retired' END)
            || ' since ' || to_char(cur."effectiveDate", 'DD Mon YYYY')
          FROM "PartnerRole" pr
          JOIN "PartnerCoverage" c ON c."partnerRoleId" = pr.id
          JOIN LATERAL (
            SELECT s.status, s."effectiveDate" FROM "CoverageStatusChange" s
            WHERE s."coverageId" = c.id AND s."effectiveDate" <= ${todayStr}::date
            ORDER BY s."effectiveDate" DESC, s."createdAt" DESC LIMIT 1
          ) cur ON true
          WHERE pr."entityId" = e.id AND pr.active
            AND (cardinality(${filters.countries}::text[]) = 0 OR c.country = ANY(${filters.countries}::text[]))
            AND (cardinality(${filters.schemes}::text[]) = 0 OR c.scheme = ANY(${filters.schemes}::text[]::"Scheme"[]))
            AND cur.status <> 'RETIRED'
          ORDER BY c.scheme ASC, c.country ASC
          LIMIT 1
        ) AS coverage_chip
      FROM "Entity" e
      WHERE e."deletedAt" IS NULL
        AND e."lifecycleState" IN ('ONBOARDING', 'LIVE', 'BAU')
    ),
    filtered AS (
      SELECT *, count(*) OVER () AS total
      FROM matched
      WHERE (NOT ${hasQuery} OR rank IS NOT NULL)
        AND (NOT ${hasCountryOrScheme} OR prod_match OR cov_match)
    )
    SELECT id, rank, matched_alias, prod_match, cov_match, coverage_chip, total
    FROM filtered
    ORDER BY
      CASE WHEN ${hasQuery} THEN rank ELSE 999 END ASC,
      lower(legal_name) ASC
    LIMIT ${PAGE_SIZE} OFFSET ${(filters.page - 1) * PAGE_SIZE}
  `);

  const total = idRows.length > 0 ? Number(idRows[0].total) : 0;
  if (idRows.length === 0) return { rows: [], total: 0 };

  const ids = idRows.map((r) => r.id);
  const entities = await db.entity.findMany({
    where: { id: { in: ids } },
    include: {
      group: { select: { id: true, name: true } },
      owner: { select: { name: true, team: true } },
      customerRole: { select: { active: true } },
      partnerRole: { select: { active: true } },
    },
  });
  const byId = new Map(entities.map((e) => [e.id, e]));

  const incidentFlags = await db.contact.findMany({
    where: { entityId: { in: ids }, context: "PARTNER", role: "INCIDENT", status: "ACTIVE" },
    select: { entityId: true },
  });
  const hasIncident = new Set(incidentFlags.map((c) => c.entityId));

  const rows: SearchResultRow[] = idRows
    .map((r) => {
      const e = byId.get(r.id);
      if (!e) return null;
      return {
        id: e.id,
        legalName: e.legalName,
        matchedAlias: r.matched_alias,
        type: e.type,
        country: e.country,
        lei: e.lei,
        leiStatus: e.leiStatus,
        hasCustomerRole: e.customerRole?.active ?? false,
        hasPartnerRole: e.partnerRole?.active ?? false,
        groupId: e.group?.id ?? null,
        groupName: e.group?.name ?? null,
        ownerName: e.owner?.name ?? null,
        ownerTeam: e.owner?.team ?? null,
        lifecycleState: e.lifecycleState,
        prodMatch: r.prod_match,
        covMatch: r.cov_match,
        coverageChipText: r.coverage_chip,
        noActiveIncidentContact: (e.partnerRole?.active ?? false) && !hasIncident.has(e.id),
      };
    })
    .filter((r): r is SearchResultRow => r !== null);

  return { rows, total };
}

/** Distinct ISO country codes across entities and their products/coverage, for the filter panel. */
export async function getFilterCountries(): Promise<string[]> {
  const [entityCountries, productCountries, coverageCountries] = await Promise.all([
    db.entity.findMany({ where: { deletedAt: null, country: { not: null } }, select: { country: true }, distinct: ["country"] }),
    db.contractedProduct.findMany({ where: { cancelledAt: null }, select: { country: true }, distinct: ["country"] }),
    db.partnerCoverage.findMany({ select: { country: true }, distinct: ["country"] }),
  ]);
  const set = new Set<string>();
  for (const c of [...entityCountries, ...productCountries, ...coverageCountries]) {
    if (c.country) set.add(c.country);
  }
  return [...set].sort();
}
