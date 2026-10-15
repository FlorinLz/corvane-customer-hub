import "dotenv/config";

import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { loadAffectedCustomers } from "@/server/queries/issue-affected-customers";
import { loadLiveCoverageCustomers } from "@/server/queries/coverage-customers";

// Reads the seeded database (like tests/unit/seed): the Lloyds Partner tab and "Affected customers" on a partner issue
// share one rule, so for any scheme and country they must name the same customers.
afterAll(async () => {
  await db.$disconnect();
});

describe("Customers on a coverage and Affected customers", () => {
  for (const [scheme, country] of [["UK_COP", "GB"], ["EU_VOP", "DE"], ["EU_VOP", "IT"]] as const) {
    it(`agree for ${scheme} / ${country}`, async () => {
      const listed = await loadLiveCoverageCustomers(scheme, country);
      // The parent issue only matters for existing links and attach candidates, not for who is affected.
      const { affected } = await loadAffectedCustomers("no-such-issue", scheme, country, "SEV1", new Date());
      expect([...listed.map((c) => c.entityId)].sort()).toEqual([...affected.map((a) => a.entityId)].sort());
      expect(listed.map((c) => c.entityName)).toEqual([...listed.map((c) => c.entityName)].sort((a, b) => a.localeCompare(b)));
    });
  }

  it("Lloyds UK CoP / GB reaches Revolut Ltd, and the list is not empty", async () => {
    const listed = await loadLiveCoverageCustomers("UK_COP", "GB");
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.map((c) => c.entityName)).toContain("Revolut Ltd");
  });
});
