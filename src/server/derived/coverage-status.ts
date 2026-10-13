import type { CoverageStatus } from "@prisma/client";

import type { LocalDate } from "@/lib/dates";

export interface CoverageStatusChangeLike {
  status: CoverageStatus;
  effectiveDate: LocalDate;
  createdAt: Date;
}

export interface CoverageStatusResult {
  current: { status: CoverageStatus; effectiveDate: LocalDate } | null;
  scheduled: { status: CoverageStatus; effectiveDate: LocalDate } | null;
}

/**
 * Brief 3.2.4 "Coverage status". Current = the change with the latest
 * effectiveDate <= today, ties broken by latest createdAt. Scheduled =
 * the earliest change with effectiveDate > today. A row whose only
 * change is in the future has no current status (M5 AC17).
 */
export function computeCoverageStatus(
  changes: CoverageStatusChangeLike[],
  today: LocalDate,
): CoverageStatusResult {
  const past = changes.filter((c) => c.effectiveDate <= today);
  const future = changes.filter((c) => c.effectiveDate > today);

  past.sort((a, b) => {
    if (a.effectiveDate !== b.effectiveDate) return a.effectiveDate < b.effectiveDate ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  future.sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));

  return {
    current: past.length > 0 ? { status: past[0].status, effectiveDate: past[0].effectiveDate } : null,
    scheduled: future.length > 0 ? { status: future[0].status, effectiveDate: future[0].effectiveDate } : null,
  };
}
