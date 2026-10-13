import { describe, expect, it } from "vitest";

import { computeKybStatus } from "@/server/derived/kyb-status";

describe("computeKybStatus", () => {
  const today = "2026-10-02";

  it("Not started when never verified", () => {
    expect(
      computeKybStatus({ type: "LICENCE", verifiedOn: null, expiryDate: null, noExpiry: false, today }),
    ).toBe("NOT_STARTED");
  });

  it("Licence: Verified with no expiry", () => {
    expect(
      computeKybStatus({ type: "LICENCE", verifiedOn: "2026-01-01", expiryDate: null, noExpiry: true, today }),
    ).toBe("VERIFIED");
  });

  it("Licence: Expiring within 90 days, Expired in the past", () => {
    expect(
      computeKybStatus({ type: "LICENCE", verifiedOn: "2026-01-01", expiryDate: "2026-10-25", noExpiry: false, today }),
    ).toBe("EXPIRING");
    expect(
      computeKybStatus({ type: "LICENCE", verifiedOn: "2026-01-01", expiryDate: "2026-09-01", noExpiry: false, today }),
    ).toBe("EXPIRED");
  });

  it("LEI: Expired when the GLEIF status is invalid, regardless of renewal date", () => {
    expect(
      computeKybStatus({
        type: "LEI", verifiedOn: "2026-01-01", expiryDate: null, noExpiry: false,
        entityLeiStatus: "LAPSED", entityLeiNextRenewalDate: "2027-01-01", today,
      }),
    ).toBe("EXPIRED");
  });

  it("LEI not found in GLEIF is Expired", () => {
    expect(
      computeKybStatus({
        type: "LEI", verifiedOn: "2026-01-01", expiryDate: null, noExpiry: false,
        entityGleifRawStatus: "NOT_FOUND", today,
      }),
    ).toBe("EXPIRED");
  });

  it("LEI: Verified by renewal date when status is Issued", () => {
    expect(
      computeKybStatus({
        type: "LEI", verifiedOn: "2026-01-01", expiryDate: null, noExpiry: false,
        entityLeiStatus: "ISSUED", entityLeiNextRenewalDate: "2027-04-25", today,
      }),
    ).toBe("VERIFIED");
  });

  it("Ownership structure and Sanctions screening never expire once verified", () => {
    expect(
      computeKybStatus({ type: "OWNERSHIP_STRUCTURE", verifiedOn: "2020-01-01", expiryDate: null, noExpiry: false, today }),
    ).toBe("VERIFIED");
    expect(
      computeKybStatus({ type: "SANCTIONS_SCREENING", verifiedOn: "2020-01-01", expiryDate: null, noExpiry: false, today }),
    ).toBe("VERIFIED");
  });
});
