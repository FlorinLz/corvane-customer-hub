import { describe, expect, it } from "vitest";

import { bicCountryCode, isValidBic, normaliseBic } from "@/lib/validation/bic";

// Importing COUNTRIES here is fine: this test runs under Vitest/Node,
// never bundled for the browser (unlike the validator itself).
import { COUNTRIES } from "@/server/config";

const countryCodes = new Set(COUNTRIES.map((c) => c.code));

describe("isValidBic (brief AC4, ISO 9362)", () => {
  it("accepts a valid 8-character BIC", () => {
    expect(isValidBic("ABBYGB2L", countryCodes)).toBe(true);
  });

  it("accepts a valid 11-character BIC", () => {
    expect(isValidBic("ABBYGB2LXXX", countryCodes)).toBe(true);
  });

  it("lowercase input is accepted and normalised", () => {
    expect(isValidBic("abbygb2l", countryCodes)).toBe(true);
    expect(normaliseBic("abbygb2l")).toBe("ABBYGB2L");
  });

  it("rejects the wrong length", () => {
    expect(isValidBic("ABBYGB2", countryCodes)).toBe(false);
    expect(isValidBic("ABBYGB2LX", countryCodes)).toBe(false);
  });

  it("rejects an invalid ISO country code in positions 5-6", () => {
    expect(isValidBic("ABBYZZ2L", countryCodes)).toBe(false);
  });

  it("extracts the country code", () => {
    expect(bicCountryCode("ABBYGB2L")).toBe("GB");
  });
});
