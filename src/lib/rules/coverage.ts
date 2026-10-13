import type { CoverageStatus } from "@prisma/client";

import type { LocalDate } from "@/lib/dates";
import { formatDate } from "@/lib/dates";

export type CoverageStatusChangeError = { field: "status" | "effectiveDate"; message: string };

/**
 * Brief 3.4.2 "Coverage", M5 AC7, AC8, AC17. M5 R1: a Retired row may only
 * move back to Onboarding; the effective date must fall between the
 * current status's own date and today (max-30-days-ahead is R2, guard 4).
 */
export function validateCoverageStatusChange(input: {
  currentStatus: CoverageStatus | null;
  currentEffectiveDate: LocalDate | null;
  newStatus: CoverageStatus;
  newEffectiveDate: LocalDate;
  today: LocalDate;
}): CoverageStatusChangeError | null {
  if (input.currentStatus === "RETIRED" && input.newStatus !== "ONBOARDING") {
    return { field: "status", message: "A Retired coverage can only move back to Onboarding" };
  }
  if (input.newEffectiveDate > input.today) {
    return { field: "effectiveDate", message: "Effective date can be at most 30 days ahead" };
  }
  if (input.currentEffectiveDate && input.newEffectiveDate < input.currentEffectiveDate) {
    return {
      field: "effectiveDate",
      message: `Effective date cannot be earlier than ${formatDate(input.currentEffectiveDate)} (current status date)`,
    };
  }
  return null;
}
