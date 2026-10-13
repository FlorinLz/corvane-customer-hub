import { describe, expect, it } from "vitest";

import { computeReviewStatus } from "@/server/derived/review-status";

describe("computeReviewStatus", () => {
  const today = "2026-10-02";

  it("Planned stays Planned when the next review date is in the future", () => {
    expect(computeReviewStatus({ storedStatus: "PLANNED", nextReviewDate: "2026-12-01", today })).toBe("PLANNED");
  });

  it("Planned becomes Overdue when the next review date has passed", () => {
    expect(computeReviewStatus({ storedStatus: "PLANNED", nextReviewDate: "2026-09-27", today })).toBe("OVERDUE");
  });

  it("In progress becomes Overdue too", () => {
    expect(computeReviewStatus({ storedStatus: "IN_PROGRESS", nextReviewDate: "2026-09-27", today })).toBe("OVERDUE");
  });

  it("Completed never becomes Overdue", () => {
    expect(computeReviewStatus({ storedStatus: "COMPLETED", nextReviewDate: "2026-01-01", today })).toBe("COMPLETED");
  });
});
