import { describe, expect, it } from "vitest";

import { mergeDuplicateMatches, type RawDuplicateMatch } from "@/lib/rules/duplicates";

describe("mergeDuplicateMatches (brief 3.6.2 steps 3-4, M2 AC11)", () => {
  it("keeps the strongest reason per entity: LEI beats NAME", () => {
    const rows: RawDuplicateMatch[] = [
      { entityId: "e1", reason: "NAME", score: 0.9, legalName: "Santander Consumer Bank S.p.A." },
      { entityId: "e1", reason: "LEI", score: 1.0, legalName: "Santander Consumer Bank S.p.A." },
    ];
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged).toEqual([{ entityId: "e1", reason: "LEI", score: 1.0, legalName: "Santander Consumer Bank S.p.A." }]);
  });

  it("sorts LEI first, then BIC, then Name", () => {
    const rows: RawDuplicateMatch[] = [
      { entityId: "name1", reason: "NAME", score: 0.95, legalName: "Name Co" },
      { entityId: "bic1", reason: "BIC", score: 1.0, legalName: "Bic Co" },
      { entityId: "lei1", reason: "LEI", score: 1.0, legalName: "Lei Co" },
    ];
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged.map((m) => m.entityId)).toEqual(["lei1", "bic1", "name1"]);
  });

  it("within the same reason, sorts by score descending", () => {
    const rows: RawDuplicateMatch[] = [
      { entityId: "low", reason: "NAME", score: 0.86, legalName: "Low Score" },
      { entityId: "high", reason: "NAME", score: 0.99, legalName: "High Score" },
    ];
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged.map((m) => m.entityId)).toEqual(["high", "low"]);
  });

  it("breaks same-reason, same-score ties by legal name", () => {
    const rows: RawDuplicateMatch[] = [
      { entityId: "z", reason: "LEI", score: 1.0, legalName: "Zeta Bank" },
      { entityId: "a", reason: "LEI", score: 1.0, legalName: "Alpha Bank" },
    ];
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged.map((m) => m.entityId)).toEqual(["a", "z"]);
  });

  it("caps at maxMatches, keeping the strongest", () => {
    const rows: RawDuplicateMatch[] = Array.from({ length: 8 }, (_, i) => ({
      entityId: `e${i}`,
      reason: "NAME" as const,
      score: 0.9 - i * 0.01,
      legalName: `Entity ${i}`,
    }));
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged).toHaveLength(5);
    expect(merged.map((m) => m.entityId)).toEqual(["e0", "e1", "e2", "e3", "e4"]);
  });

  it("takes the max score when the same entity matches NAME twice (exact core and trigram)", () => {
    const rows: RawDuplicateMatch[] = [
      { entityId: "e1", reason: "NAME", score: 0.87, legalName: "Entity" },
      { entityId: "e1", reason: "NAME", score: 1.0, legalName: "Entity" },
    ];
    const merged = mergeDuplicateMatches(rows, 5);
    expect(merged).toEqual([{ entityId: "e1", reason: "NAME", score: 1.0, legalName: "Entity" }]);
  });
});
