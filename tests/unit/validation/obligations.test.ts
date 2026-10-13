import { describe, expect, it } from "vitest";

import { obligationsSchema } from "@/lib/validation/obligations";

function errorsFor(input: Record<string, unknown>) {
  const result = obligationsSchema.safeParse({ version: 0, ...input });
  if (result.success) return null;
  return result.error.issues.map((i) => i.message);
}

describe("obligationsSchema (brief 3.4.2 Obligations, M13 AC2-AC4)", () => {
  it("rejects a non-whole-number incident notification time with the exact copy", () => {
    expect(errorsFor({ incidentNoticeHours: 4.5 })).toContain("Enter a whole number of hours between 1 and 720");
  });

  it("accepts the boundaries 1 and 720 for incident notification time", () => {
    expect(errorsFor({ incidentNoticeHours: 1 })).toBeNull();
    expect(errorsFor({ incidentNoticeHours: 720 })).toBeNull();
    expect(errorsFor({ incidentNoticeHours: 721 })).toContain("Enter a whole number of hours between 1 and 720");
    expect(errorsFor({ incidentNoticeHours: 0 })).toContain("Enter a whole number of hours between 1 and 720");
  });

  it("subprocessor change notice accepts 0 to 365 whole days", () => {
    expect(errorsFor({ subprocessorNoticeDays: 0 })).toBeNull();
    expect(errorsFor({ subprocessorNoticeDays: 365 })).toBeNull();
    expect(errorsFor({ subprocessorNoticeDays: 366 })).toContain("Enter a whole number of days between 0 and 365");
    expect(errorsFor({ subprocessorNoticeDays: 1.5 })).toContain("Enter a whole number of days between 0 and 365");
  });

  it("availability SLA accepts 90.00 to 100.00 with up to 2 decimals", () => {
    expect(errorsFor({ availabilitySlaPct: 99.95 })).toBeNull();
    expect(errorsFor({ availabilitySlaPct: 100 })).toBeNull();
    expect(errorsFor({ availabilitySlaPct: 89.99 })).toContain("Enter a percentage between 90.00 and 100.00");
    expect(errorsFor({ availabilitySlaPct: 99.999 })).toContain("Enter a percentage between 90.00 and 100.00");
  });

  it("every field is optional (a card can be partially captured)", () => {
    expect(obligationsSchema.safeParse({ version: 0 }).success).toBe(true);
  });
});
