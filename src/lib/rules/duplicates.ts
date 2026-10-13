export type DuplicateReason = "LEI" | "BIC" | "NAME";

const REASON_RANK: Record<DuplicateReason, number> = { LEI: 0, BIC: 1, NAME: 2 };

export interface RawDuplicateMatch {
  entityId: string;
  reason: DuplicateReason;
  score: number;
  legalName: string;
}

export interface MergedDuplicateMatch {
  entityId: string;
  reason: DuplicateReason;
  score: number;
  legalName: string;
}

/**
 * Brief 3.6.2 steps 3-4. Merge raw Q1-Q4 rows by entity: an entity matched
 * by several reasons keeps only its strongest one (LEI, then BIC, then
 * Name) for the card's reason chip and for sorting. Sort LEI first, then
 * BIC, then Name by score descending, then legal name; keep the first
 * `maxMatches` (brief `DUPLICATE_MAX_MATCHES`, M2 AC11).
 */
export function mergeDuplicateMatches(rows: RawDuplicateMatch[], maxMatches: number): MergedDuplicateMatch[] {
  const byEntity = new Map<string, MergedDuplicateMatch>();
  for (const row of rows) {
    const existing = byEntity.get(row.entityId);
    if (!existing || REASON_RANK[row.reason] < REASON_RANK[existing.reason]) {
      byEntity.set(row.entityId, { entityId: row.entityId, reason: row.reason, score: row.score, legalName: row.legalName });
    } else if (row.reason === existing.reason && row.score > existing.score) {
      existing.score = row.score;
    }
  }

  return [...byEntity.values()]
    .sort((a, b) => {
      if (REASON_RANK[a.reason] !== REASON_RANK[b.reason]) return REASON_RANK[a.reason] - REASON_RANK[b.reason];
      if (b.score !== a.score) return b.score - a.score;
      return a.legalName.localeCompare(b.legalName);
    })
    .slice(0, maxMatches);
}
