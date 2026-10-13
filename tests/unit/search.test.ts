import "dotenv/config";

import { describe, expect, it } from "vitest";

import { runSearch } from "@/server/queries/search";
import { runObligationsSearch } from "@/server/queries/obligations";

/**
 * Brief 5.4 "Worked examples (seed; use as tests)" and the Obligations
 * scenario check (3.7.5), exercised against the real search service
 * (not just data-level assertions). R1 scope: no role/stage/coverage/
 * lifecycle/owner filters, no contract ID matching.
 */
describe("Search service (M1 AC2 to AC9, M5 AC16)", () => {
  it("'Financial Services' matches only Zopa by alias (Adyen's legal name doesn't contain it)", async () => {
    const { rows, total } = await runSearch({ q: "Financial Services", countries: [], schemes: [], page: 1 });
    expect(total).toBe(1);
    expect(rows[0].legalName).toBe("Zopa Bank Limited");
    expect(rows[0].matchedAlias).toBe("Zopa Financial Services");
  });

  it("'mps' matches Banca Monte dei Paschi di Siena S.p.A. by alias MPS", async () => {
    const { rows, total } = await runSearch({ q: "mps", countries: [], schemes: [], page: 1 });
    expect(total).toBe(1);
    expect(rows[0].legalName).toBe("Banca Monte dei Paschi di Siena S.p.A.");
    expect(rows[0].matchedAlias).toBe("MPS");
  });

  it("'Santander' returns exactly the 4 seeded Santander group entities", async () => {
    const { rows, total } = await runSearch({ q: "Santander", countries: [], schemes: [], page: 1 });
    expect(total).toBe(4);
    expect(rows.map((r) => r.legalName).sort()).toEqual(
      [
        "Santander UK plc",
        "Banco Santander Totta, S.A.",
        "Santander Consumer Bank S.p.A.",
        "Banco Santander Consumer Portugal S.A.",
      ].sort(),
    );
    expect(rows.every((r) => r.groupName === "Santander")).toBe(true);
  });

  it("'HYVEDEMM' matches UniCredit Bank GmbH by BIC prefix", async () => {
    const { rows, total } = await runSearch({ q: "HYVEDEMM", countries: [], schemes: [], page: 1 });
    expect(total).toBe(1);
    expect(rows[0].legalName).toBe("UniCredit Bank GmbH");
  });

  it("'Lloyds' and 'Lloyds TSB' both resolve to the single Lloyds Bank plc row", async () => {
    const byName = await runSearch({ q: "Lloyds", countries: [], schemes: [], page: 1 });
    expect(byName.total).toBe(1);
    expect(byName.rows[0].legalName).toBe("Lloyds Bank plc");
    expect(byName.rows[0].hasCustomerRole).toBe(true);
    expect(byName.rows[0].hasPartnerRole).toBe(true);

    const byAlias = await runSearch({ q: "Lloyds TSB", countries: [], schemes: [], page: 1 });
    expect(byAlias.total).toBe(1);
    expect(byAlias.rows[0].legalName).toBe("Lloyds Bank plc");
    expect(byAlias.rows[0].matchedAlias).toBe("Lloyds TSB Bank plc");
  });

  it("Country=GB, Scheme=UK CoP: Lloyds shows both match chips, Monzo is absent", async () => {
    const { rows, total } = await runSearch({ q: "", countries: ["GB"], schemes: ["UK_COP"], page: 1 });
    expect(total).toBe(4);
    expect(rows.map((r) => r.legalName)).not.toContain("Monzo Bank Ltd");
    const lloyds = rows.find((r) => r.legalName === "Lloyds Bank plc");
    expect(lloyds?.prodMatch).toBe(true);
    expect(lloyds?.covMatch).toBe(true);
    expect(lloyds?.coverageChipText).toMatch(/^GB \/ UK CoP/);
  });

  it("Country=GB, Scheme=EU VoP: empty state when nothing matches both", async () => {
    const { total } = await runSearch({ q: "", countries: ["GB"], schemes: ["EU_VOP"], page: 1 });
    expect(total).toBe(0);
  });
});

describe("Obligations view (M13 AC9 to AC13), Customer rows only (R1)", () => {
  it("Country=GB, Scheme=UK CoP, sort Incident notice ascending: Revolut 2h, Santander UK 4h, Lloyds 8h, Zopa not captured last; Monzo drops out", async () => {
    const { rows, total } = await runObligationsSearch({
      q: "",
      countries: ["GB"],
      schemes: ["UK_COP"],
      sort: "in_asc",
      page: 1,
    });
    expect(total).toBe(4);
    expect(rows.map((r) => r.legalName)).toEqual(["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc", "Zopa Bank Limited"]);
    expect(rows.map((r) => r.incidentNoticeHours)).toEqual([2, 4, 8, null]);
    expect(rows.find((r) => r.legalName === "Monzo Bank Ltd")).toBeUndefined();
  });
});
