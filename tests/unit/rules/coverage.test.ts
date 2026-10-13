import { describe, expect, it } from "vitest";

import { validateCoverageStatusChange } from "@/lib/rules/coverage";

describe("validateCoverageStatusChange (brief 3.4.2 Coverage, M5 AC7, AC8, AC17) — M5 R1 cases", () => {
  const today = "2026-10-02";

  it("a Retired row may only move to Onboarding", () => {
    const err = validateCoverageStatusChange({
      currentStatus: "RETIRED",
      currentEffectiveDate: "2026-01-01",
      newStatus: "ACTIVE",
      newEffectiveDate: today,
      today,
    });
    expect(err).toEqual({ field: "status", message: "A Retired coverage can only move back to Onboarding" });
  });

  it("a Retired row moving to Onboarding is allowed", () => {
    expect(
      validateCoverageStatusChange({ currentStatus: "RETIRED", currentEffectiveDate: "2026-01-01", newStatus: "ONBOARDING", newEffectiveDate: today, today }),
    ).toBeNull();
  });

  it("rejects an effective date after today (R1: no future-dated Scheduled status)", () => {
    const err = validateCoverageStatusChange({ currentStatus: "ACTIVE", currentEffectiveDate: "2026-09-01", newStatus: "DEGRADED", newEffectiveDate: "2026-10-03", today });
    expect(err).toEqual({ field: "effectiveDate", message: "Effective date can be at most 30 days ahead" });
  });

  it("rejects an effective date earlier than the current status's own date, naming it in the message", () => {
    const err = validateCoverageStatusChange({ currentStatus: "ACTIVE", currentEffectiveDate: "2026-09-12", newStatus: "DEGRADED", newEffectiveDate: "2026-09-01", today });
    expect(err).toEqual({ field: "effectiveDate", message: "Effective date cannot be earlier than 12 Sep 2026 (current status date)" });
  });

  it("accepts an effective date of today for a row with no current status yet", () => {
    expect(
      validateCoverageStatusChange({ currentStatus: null, currentEffectiveDate: null, newStatus: "ONBOARDING", newEffectiveDate: today, today }),
    ).toBeNull();
  });
});
