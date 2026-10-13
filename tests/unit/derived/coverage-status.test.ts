import { describe, expect, it } from "vitest";

import { computeCoverageStatus } from "@/server/derived/coverage-status";

describe("computeCoverageStatus", () => {
  const today = "2026-10-02";

  it("current = the change with the latest effectiveDate <= today", () => {
    const r = computeCoverageStatus(
      [
        { status: "ONBOARDING", effectiveDate: "2026-08-04", createdAt: new Date("2026-08-04") },
        { status: "ACTIVE", effectiveDate: "2026-09-12", createdAt: new Date("2026-09-12") },
      ],
      today,
    );
    expect(r.current).toEqual({ status: "ACTIVE", effectiveDate: "2026-09-12" });
    expect(r.scheduled).toBeNull();
  });

  it("ties on effectiveDate break by latest createdAt", () => {
    const r = computeCoverageStatus(
      [
        { status: "ONBOARDING", effectiveDate: "2026-09-12", createdAt: new Date("2026-09-12T09:00:00Z") },
        { status: "ACTIVE", effectiveDate: "2026-09-12", createdAt: new Date("2026-09-12T10:00:00Z") },
      ],
      today,
    );
    expect(r.current?.status).toBe("ACTIVE");
  });

  it("a row whose only change is in the future has no current status, only scheduled (M5 AC17)", () => {
    const r = computeCoverageStatus(
      [{ status: "ACTIVE", effectiveDate: "2026-10-20", createdAt: new Date("2026-10-01") }],
      today,
    );
    expect(r.current).toBeNull();
    expect(r.scheduled).toEqual({ status: "ACTIVE", effectiveDate: "2026-10-20" });
  });
});
