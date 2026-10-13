import type { LifecycleState, Team } from "@prisma/client";

import { db } from "@/server/db";
import { duplicateNameThreshold, DUPLICATE_MAX_MATCHES, TRANSACTION_OPTIONS } from "@/server/config";
import { normaliseCore } from "@/lib/validation/normalise";
import { mergeDuplicateMatches, type DuplicateReason, type RawDuplicateMatch } from "@/lib/rules/duplicates";

export interface DuplicateCheckInput {
  lei?: string | null;
  bics: string[];
  legalName?: string | null;
  aliases: string[];
  excludeEntityId?: string;
}

export interface DuplicateMatch {
  entityId: string;
  reason: DuplicateReason;
  legalName: string;
  country: string | null;
  lei: string | null;
  hasCustomerRole: boolean;
  hasPartnerRole: boolean;
  ownerName: string | null;
  ownerTeam: Team | null;
  lifecycleState: LifecycleState;
  deletedAt: Date | null;
  addCustomerRoleCandidate: boolean;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Brief 3.6.2. Up to `DUPLICATE_MAX_MATCHES` matches by LEI, BIC (first 8
 * characters) or normalised name/alias (exact or trigram-similar). Runs
 * over all entities, soft-deleted included (M2 AC9, M16 edge 3).
 */
export async function checkDuplicates(input: DuplicateCheckInput): Promise<DuplicateMatch[]> {
  const cores = unique([input.legalName, ...input.aliases].filter((v): v is string => !!v && v.trim().length > 0).map(normaliseCore)).filter(Boolean);
  const bic8s = unique(input.bics.map((b) => b.trim().toUpperCase().slice(0, 8)).filter((b) => b.length === 8));
  const lei = input.lei?.trim() || null;
  const excludeId = input.excludeEntityId ?? "__none__";

  if (!lei && bic8s.length === 0 && cores.length === 0) return [];

  const threshold = duplicateNameThreshold();

  const rawRows = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', ${String(threshold)}, true)`;

    return tx.$queryRaw<{ id: string; reason: string; score: number; legal_name: string }[]>`
      SELECT e.id, 'LEI' AS reason, 1.0::real AS score, e."legalName" AS legal_name
      FROM "Entity" e WHERE e.lei = ${lei} AND e.id != ${excludeId}

      UNION ALL

      SELECT e.id, 'BIC' AS reason, 1.0::real AS score, e."legalName" AS legal_name
      FROM "EntityBic" b JOIN "Entity" e ON e.id = b."entityId"
      WHERE b.bic8 = ANY(${bic8s}) AND e.id != ${excludeId}

      UNION ALL

      SELECT e.id, 'NAME' AS reason, 1.0::real AS score, e."legalName" AS legal_name
      FROM "Entity" e WHERE e."legalNameCore" = ANY(${cores}) AND e.id != ${excludeId}

      UNION ALL

      SELECT e.id, 'NAME' AS reason, 1.0::real AS score, e."legalName" AS legal_name
      FROM "EntityAlias" a JOIN "Entity" e ON e.id = a."entityId"
      WHERE a."aliasCore" = ANY(${cores}) AND e.id != ${excludeId}

      UNION ALL

      SELECT e.id, 'NAME' AS reason, max(similarity(e."legalNameCore", c))::real AS score, e."legalName" AS legal_name
      FROM "Entity" e, unnest(${cores}::text[]) c
      WHERE e."legalNameCore" % c AND e.id != ${excludeId}
      GROUP BY e.id, e."legalName"

      UNION ALL

      SELECT e.id, 'NAME' AS reason, max(similarity(a."aliasCore", c))::real AS score, e."legalName" AS legal_name
      FROM "EntityAlias" a JOIN "Entity" e ON e.id = a."entityId", unnest(${cores}::text[]) c
      WHERE a."aliasCore" % c AND e.id != ${excludeId}
      GROUP BY e.id, e."legalName"
    `;
  }, TRANSACTION_OPTIONS);

  const raw: RawDuplicateMatch[] = rawRows.map((r) => ({
    entityId: r.id,
    reason: r.reason as DuplicateReason,
    score: r.score,
    legalName: r.legal_name,
  }));
  const merged = mergeDuplicateMatches(raw, DUPLICATE_MAX_MATCHES);
  if (merged.length === 0) return [];

  const ids = merged.map((m) => m.entityId);
  const entities = await db.entity.findMany({
    where: { id: { in: ids } },
    include: {
      owner: { select: { name: true, team: true } },
      customerRole: { select: { active: true } },
      partnerRole: { select: { active: true } },
    },
  });
  const byId = new Map(entities.map((e) => [e.id, e]));

  return merged.flatMap((m): DuplicateMatch[] => {
    const entity = byId.get(m.entityId);
    if (!entity) return [];
    const hasCustomerRole = entity.customerRole?.active ?? false;
    const hasPartnerRole = entity.partnerRole?.active ?? false;
    return [
      {
        entityId: entity.id,
        reason: m.reason,
        legalName: entity.legalName,
        country: entity.country,
        lei: entity.lei,
        hasCustomerRole,
        hasPartnerRole,
        ownerName: entity.owner?.name ?? null,
        ownerTeam: entity.owner?.team ?? null,
        lifecycleState: entity.lifecycleState,
        deletedAt: entity.deletedAt,
        addCustomerRoleCandidate: m.reason === "LEI" && hasPartnerRole && !hasCustomerRole,
      },
    ];
  });
}
