import type { ReviewStatus } from "@prisma/client";

import type { LocalDate } from "@/lib/dates";

/**
 * Brief 3.2.4 "Review status" (M12 AC12). Stored status is PLANNED or
 * IN_PROGRESS; effective status is OVERDUE when nextReviewDate is in the
 * past.
 */
export function computeReviewStatus(input: {
  storedStatus: ReviewStatus;
  nextReviewDate: LocalDate;
  today: LocalDate;
}): ReviewStatus {
  if (
    (input.storedStatus === "PLANNED" || input.storedStatus === "IN_PROGRESS") &&
    input.nextReviewDate < input.today
  ) {
    return "OVERDUE";
  }
  return input.storedStatus;
}
