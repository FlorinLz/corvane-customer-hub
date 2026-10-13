import { describe, expect, it } from "vitest";

import { entersLiveHypercareFirstTime, validateStageChange } from "@/lib/rules/stage-engine";

describe("validateStageChange (brief 4.3, M6 AC4-AC6) — M5 R1: forward N -> N+1 only", () => {
  const today = "2026-10-02";

  it("allows a forward N -> N+1 move", () => {
    expect(
      validateStageChange({ fromStage: "UAT", toStage: "GO_LIVE_APPROVAL", entryDate: today, stageEnteredAt: "2026-09-20", today }),
    ).toBeNull();
  });

  it("rejects a skip (N -> N+2)", () => {
    const err = validateStageChange({ fromStage: "UAT", toStage: "LIVE_HYPERCARE", entryDate: today, stageEnteredAt: "2026-09-20", today });
    expect(err).toEqual({ field: "toStage", message: "Skipping or moving back a stage isn't available yet" });
  });

  it("rejects a backward move", () => {
    const err = validateStageChange({ fromStage: "UAT", toStage: "KICKOFF", entryDate: today, stageEnteredAt: "2026-09-20", today });
    expect(err?.field).toBe("toStage");
  });

  it("rejects an entry date in the future", () => {
    const err = validateStageChange({ fromStage: "UAT", toStage: "GO_LIVE_APPROVAL", entryDate: "2026-10-03", stageEnteredAt: "2026-09-20", today });
    expect(err).toEqual({ field: "entryDate", message: "Entry date cannot be in the future" });
  });

  it("rejects an entry date before the current stage's own entry date, with the date in the message", () => {
    const err = validateStageChange({ fromStage: "UAT", toStage: "GO_LIVE_APPROVAL", entryDate: "2026-09-19", stageEnteredAt: "2026-09-20", today });
    expect(err).toEqual({ field: "entryDate", message: "Entry date cannot be earlier than 20 Sep 2026 (current stage date)" });
  });

  it("accepts an entry date equal to the current stage's own entry date", () => {
    expect(
      validateStageChange({ fromStage: "UAT", toStage: "GO_LIVE_APPROVAL", entryDate: "2026-09-20", stageEnteredAt: "2026-09-20", today }),
    ).toBeNull();
  });
});

describe("entersLiveHypercareFirstTime (brief 3.2.4, M6 AC11)", () => {
  it("is true moving into Live & hypercare with no billable-from date yet", () => {
    expect(entersLiveHypercareFirstTime("LIVE_HYPERCARE", null)).toBe(true);
  });

  it("is false for any other stage", () => {
    expect(entersLiveHypercareFirstTime("GO_LIVE_APPROVAL", null)).toBe(false);
  });

  it("is false when a billable-from date is already set (not overwritten on a later move)", () => {
    expect(entersLiveHypercareFirstTime("LIVE_HYPERCARE", "2026-08-01")).toBe(false);
  });
});
