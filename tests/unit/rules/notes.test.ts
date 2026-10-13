import { describe, expect, it } from "vitest";

import { isDueDateValidAtCreation } from "@/lib/rules/notes";

describe("isDueDateValidAtCreation (brief 3.4.2 Note / Action items, M10 AC2, AC3)", () => {
  const today = "2026-10-02";

  it("accepts a due date of today", () => {
    expect(isDueDateValidAtCreation(today, today)).toBe(true);
  });

  it("accepts a future due date", () => {
    expect(isDueDateValidAtCreation("2026-10-16", today)).toBe(true);
  });

  it("rejects a due date in the past", () => {
    expect(isDueDateValidAtCreation("2026-10-01", today)).toBe(false);
  });
});
