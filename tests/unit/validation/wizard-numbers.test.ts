import { describe, expect, it } from "vitest";

import { wizardCommercialTermsSchema, wizardSlasSchema } from "@/lib/validation/customer-wizard";

const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("New customer wizard: an empty number field reads \"Enter a number\"", () => {
  it("never shows zod's own 'expected number, received NaN'", () => {
    const result = wizardCommercialTermsSchema.safeParse({ currency: "EUR", pricePerVerification: Number.NaN, volumeTiers: [], monthlyMinimum: null, paymentTermDays: Number.NaN });
    const all = messages(result);
    expect(all).toEqual(["Enter a number", "Enter a number"]);
    expect(all.join(" ")).not.toMatch(/NaN|expected number/);
  });

  it("keeps the range messages for a number that is there", () => {
    const result = wizardCommercialTermsSchema.safeParse({ currency: "EUR", pricePerVerification: 0, volumeTiers: [], monthlyMinimum: null, paymentTermDays: 400 });
    expect(messages(result)).toEqual(["Enter a price greater than 0 with up to 4 decimals", "Enter a whole number from 1 to 180"]);
  });

  it("the SLA fields say it too", () => {
    expect(messages(wizardSlasSchema.safeParse({ availabilityPct: "x", maxResponseMs: null, other: null }))).toEqual(["Enter a number"]);
  });
});

describe("New customer wizard: an empty product line reads in plain words", () => {
  it("country, contracting entity and go-live say what to do, not zod's 'Too small'", async () => {
    const { createWizardProductsStepSchema } = await import("@/lib/validation/customer-wizard");
    const r = createWizardProductsStepSchema(["DE"]).safeParse({
      productLines: [{ product: "EU_VOP", country: "", contractingEntityId: "", targetGoLive: "" }],
      commercialTerms: { currency: "EUR", pricePerVerification: 0.04, volumeTiers: [], monthlyMinimum: null, paymentTermDays: 30 },
      slas: { availabilityPct: null, maxResponseMs: null, other: null },
      specialTerms: null,
      entitiesNotInPortal: null,
    });
    const all = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(all).toEqual(expect.arrayContaining(["Select a country", "Select the contracting entity", "Enter the target go-live date"]));
    expect(all.join(" ")).not.toMatch(/Too small|expected string/);
  });
});
