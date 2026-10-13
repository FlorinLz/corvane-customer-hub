import { describe, expect, it } from "vitest";

import { contactDataArea, contactOwnerTeams } from "@/server/derived/contact-ownership";

describe("contactOwnerTeams (brief 3.2 notes / M15 AC4, rules/permissions.test.ts R1 case)", () => {
  it("Billing is owned by Finance in both Customer and Partner contexts", () => {
    expect(contactOwnerTeams("CUSTOMER", "BILLING")).toEqual(["FINANCE"]);
    expect(contactOwnerTeams("PARTNER", "BILLING")).toEqual(["FINANCE"]);
  });

  it("Partner context (non-Billing) is owned by Network", () => {
    expect(contactOwnerTeams("PARTNER", "INCIDENT")).toEqual(["NETWORK"]);
    expect(contactOwnerTeams("PARTNER", "TECHNICAL")).toEqual(["NETWORK"]);
  });

  it("Customer context Champion/Decision maker are owned by Sales and Customer Success", () => {
    expect(contactOwnerTeams("CUSTOMER", "CHAMPION")).toEqual(["SALES", "CS"]);
    expect(contactOwnerTeams("CUSTOMER", "DECISION_MAKER")).toEqual(["SALES", "CS"]);
  });

  it("Customer context Technical/Incident/Escalation are owned by Ops", () => {
    expect(contactOwnerTeams("CUSTOMER", "TECHNICAL")).toEqual(["OPS"]);
    expect(contactOwnerTeams("CUSTOMER", "INCIDENT")).toEqual(["OPS"]);
    expect(contactOwnerTeams("CUSTOMER", "ESCALATION")).toEqual(["OPS"]);
  });
});

describe("contactDataArea (matrix area for a contact write, mirrors contactOwnerTeams)", () => {
  it("maps each (context, role) to the matrix area with the matching owner team(s)", () => {
    expect(contactDataArea("CUSTOMER", "BILLING")).toBe("contact.FINANCE");
    expect(contactDataArea("PARTNER", "BILLING")).toBe("contact.FINANCE");
    expect(contactDataArea("PARTNER", "INCIDENT")).toBe("contact.NETWORK");
    expect(contactDataArea("CUSTOMER", "CHAMPION")).toBe("contact.SALES_CS");
    expect(contactDataArea("CUSTOMER", "TECHNICAL")).toBe("contact.OPS");
  });
});
