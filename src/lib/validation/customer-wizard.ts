import { z } from "zod";
import { ContactRole, Currency, EntityType, GleifSource, LeiStatus, Scheme } from "@prisma/client";

import { today } from "@/lib/dates";
import { isValidBic } from "@/lib/validation/bic";
import { EMAIL_RE } from "@/lib/validation/email";
import { E164_RE, normalisePhone } from "@/lib/validation/phone";
import { isValidTimeZone } from "@/lib/validation/timezone";
import { isValidAvailability } from "@/lib/validation/availability";

// Brief 5.5 "New customer wizard", R1 scope. legalName/lei/country are
// GLEIF-sourced only in R1 (no manual entry, no country override — both
// R2) so they carry through as plain strings with no bespoke validation
// beyond non-empty; Next only unlocks after a successful GLEIF lookup, so
// the server mirrors that same gate below (R1 has no override for an
// invalid LEI status and no "GLEIF unavailable" escape hatch).
const BLOCKING_LEI_STATUSES: LeiStatus[] = ["RETIRED", "MERGED", "ANNULLED", "DUPLICATE"];

// This module is imported by client wizard components for inline
// validation as well as by the server route, so — unlike most of
// src/lib/validation, which never needs external data — the two schemas
// that depend on server/config's COUNTRIES/SEPA_COUNTRIES take them as
// factory parameters instead of importing @/server/config at module
// scope (that import would otherwise get bundled into client JS the
// moment any client component imports this file at all, the same class
// of bug already hit and fixed in src/server/config.ts's siblings).

const gleifSnapshotSchema = z.object({
  leiStatus: z.enum(LeiStatus),
  gleifRawStatus: z.string().nullable(),
  leiNextRenewalDate: z.string().nullable(),
  gleifCheckedAt: z.string(), // ISO instant; the client's own lookup time
  gleifSource: z.enum(GleifSource),
  gleifLegalName: z.string().nullable(),
  gleifCountry: z.string().nullable(),
  gleifDirectParentLei: z.string().nullable(),
  gleifDirectParentName: z.string().nullable(),
  gleifUltimateParentLei: z.string().nullable(),
  gleifUltimateParentName: z.string().nullable(),
  gleifSuccessorLei: z.string().nullable(),
});

export function createWizardEntitySchema(validBicCountryCodes: ReadonlySet<string>) {
  return z
    .object({
      lei: z.string().trim().min(1, "Enter a LEI"),
      legalName: z.string().trim().min(1, "Enter the legal name"),
      country: z.string().trim().length(2, "Select the country"),
      type: z.enum(EntityType, { error: "Select the entity type" }),
      groupId: z.string().trim().nullable().optional(),
      bics: z.array(z.string()).superRefine((bics, ctx) => {
        const seen = new Set<string>();
        bics.forEach((bic, i) => {
          if (!isValidBic(bic, validBicCountryCodes)) {
            ctx.addIssue({ code: "custom", path: [i], message: "BIC must be 8 or 11 characters (e.g. ABBYGB2L or ABBYGB2LXXX)" });
            return;
          }
          const key = bic.trim().toUpperCase();
          if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "This BIC was already added" });
          seen.add(key);
        });
      }),
      aliases: z.array(z.string().trim().min(1).max(100, "100 characters or fewer")).superRefine((aliases, ctx) => {
        const seen = new Set<string>();
        aliases.forEach((alias, i) => {
          const key = alias.trim().toLowerCase();
          if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "This alias was already added" });
          seen.add(key);
        });
      }),
      gleif: gleifSnapshotSchema,
    })
    .superRefine((entity, ctx) => {
      if (BLOCKING_LEI_STATUSES.includes(entity.gleif.leiStatus)) {
        ctx.addIssue({ code: "custom", path: ["lei"], message: "This LEI is no longer valid for this entity." });
      }
      if (entity.gleif.gleifRawStatus === "NOT_FOUND") {
        ctx.addIssue({ code: "custom", path: ["lei"], message: `No GLEIF record for ${entity.lei}. Check the LEI with the customer.` });
      }
      if (entity.gleif.gleifSource === "MANUAL") {
        ctx.addIssue({ code: "custom", path: ["lei"], message: "GLEIF must be reachable to create a customer record" });
      }
    });
}
export type WizardEntityInput = z.infer<ReturnType<typeof createWizardEntitySchema>>;

// Only required when checkDuplicates found matches (brief 3.6.2 step 6).
export const duplicateAckSchema = z.object({
  confirmDuplicate: z.literal(true),
  duplicateReason: z.string().trim().min(10, "Enter a reason of 10 to 500 characters").max(500, "Enter a reason of 10 to 500 characters"),
});
export type DuplicateAckInput = z.infer<typeof duplicateAckSchema>;

function createProductLineSchema(sepaCountries: readonly string[]) {
  return z
    .object({
      product: z.enum(Scheme, { error: "Select a product" }),
      country: z.string().trim().length(2, "Select a country"),
      contractingEntityId: z.string().trim().min(1, "Select the contracting entity"),
      targetGoLive: z.string().trim().min(1, "Enter the target go-live date"),
    })
    .superRefine((line, ctx) => {
      if (line.product === "UK_COP" && line.country !== "GB") {
        ctx.addIssue({ code: "custom", path: ["country"], message: "UK CoP is available only in GB" });
      }
      if (line.product === "EU_VOP" && !sepaCountries.includes(line.country)) {
        ctx.addIssue({ code: "custom", path: ["country"], message: "EU VoP is available only in SEPA countries" });
      }
      if (line.targetGoLive < today()) {
        ctx.addIssue({ code: "custom", path: ["targetGoLive"], message: "Target go-live is in the past" });
      }
    });
}

/** A number field left empty or not numeric reads "Enter a number", never zod's own "expected number, received NaN". */
const wizardNumber = () => z.number({ error: "Enter a number" });

const volumeTierSchema = z.object({
  fromVolume: wizardNumber().int().min(0),
  toVolume: wizardNumber().int().positive().nullable(),
  pricePerVerification: wizardNumber().positive("Enter a price greater than 0 with up to 4 decimals"),
});

function checkTiersContinuous(tiers: { fromVolume: number; toVolume: number | null }[], ctx: z.RefinementCtx) {
  const sorted = [...tiers].sort((a, b) => a.fromVolume - b.fromVolume);
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    const isLast = i === sorted.length - 1;
    if (isLast !== (tier.toVolume === null)) {
      ctx.addIssue({ code: "custom", path: ["volumeTiers"], message: "Tiers must be continuous. Tiers must not overlap." });
      return;
    }
    if (!isLast) {
      const next = sorted[i + 1];
      if (tier.toVolume === null || tier.toVolume + 1 !== next.fromVolume) {
        ctx.addIssue({ code: "custom", path: ["volumeTiers"], message: "Tiers must be continuous. Tiers must not overlap." });
        return;
      }
    }
  }
}

export const wizardCommercialTermsSchema = z
  .object({
    currency: z.enum(Currency, { error: "Select a currency" }),
    pricePerVerification: wizardNumber().positive("Enter a price greater than 0 with up to 4 decimals"),
    volumeTiers: z.array(volumeTierSchema),
    monthlyMinimum: wizardNumber().min(0, "Enter 0 or more").nullable(),
    paymentTermDays: wizardNumber().int().min(1, "Enter a whole number from 1 to 180").max(180, "Enter a whole number from 1 to 180"),
  })
  .superRefine((terms, ctx) => {
    if (terms.volumeTiers.length > 0) checkTiersContinuous(terms.volumeTiers, ctx);
  });

export const wizardSlasSchema = z.object({
  availabilityPct: wizardNumber().min(0).max(100).nullable(),
  maxResponseMs: wizardNumber().int().positive().nullable(),
  other: z.string().trim().max(1000).nullable(),
});

export function createWizardProductsStepSchema(sepaCountries: readonly string[]) {
  return z.object({
    productLines: z
      .array(createProductLineSchema(sepaCountries))
      .min(1, "Select a product")
      .superRefine((lines, ctx) => {
        const seen = new Set<string>();
        lines.forEach((line, i) => {
          const key = `${line.product}|${line.country}|${line.contractingEntityId}`;
          if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: "This product line already exists" });
          seen.add(key);
        });
      }),
    commercialTerms: wizardCommercialTermsSchema,
    slas: wizardSlasSchema,
    specialTerms: z.string().trim().max(2000).nullable(),
    entitiesNotInPortal: z.string().trim().max(1000).nullable(), // R2 field, carried through as always-null in R1
  });
}
export type WizardProductsStepInput = z.infer<ReturnType<typeof createWizardProductsStepSchema>>;

// Brief M3 AC8: "Sales adds only those roles" (Champion, Decision maker).
const WIZARD_CONTACT_ROLES = [ContactRole.CHAMPION, ContactRole.DECISION_MAKER] as const;

const availabilityShape = z
  .discriminatedUnion("available24x7", [
    z.object({ available24x7: z.literal(true) }),
    z.object({
      available24x7: z.literal(false),
      days: z.array(z.number().int().min(1).max(7)),
      start: z.string(),
      end: z.string(),
    }),
  ])
  .nullable();

const wizardContactSchema = z
  .object({
    role: z.enum(WIZARD_CONTACT_ROLES, { error: "Select a role" }),
    fullName: z.string().trim().min(2, "Enter a name of 2 to 120 characters").max(120, "Enter a name of 2 to 120 characters"),
    email: z.string().trim().toLowerCase().max(254, "Enter a valid email address").regex(EMAIL_RE, "Enter a valid email address"),
    phone: z.string().trim().nullable().optional(),
    timeZone: z.string().trim().nullable().optional(),
    availability: availabilityShape.optional(),
    jobTitle: z.string().trim().max(120).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const phone = data.phone?.trim() || null;
    if (phone && !E164_RE.test(normalisePhone(phone))) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Use international format, for example +447700900123" });
    }
    const timeZone = data.timeZone?.trim() || null;
    if (timeZone && !isValidTimeZone(timeZone)) {
      ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Select a time zone" });
    }
    if (data.availability && !isValidAvailability(data.availability)) {
      ctx.addIssue({ code: "custom", path: ["availability"], message: "Set the availability window" });
    }
  });

export const wizardContactsStepSchema = z.object({
  contacts: z
    .array(wizardContactSchema)
    .min(1, "Add at least one Champion or Decision maker")
    .superRefine((contacts, ctx) => {
      const seen = new Map<string, number>();
      contacts.forEach((contact, i) => {
        const key = `${contact.email.toLowerCase()}|${contact.role}`;
        const firstIndex = seen.get(key);
        if (firstIndex !== undefined) {
          ctx.addIssue({ code: "custom", path: [i, "email"], message: `${contact.fullName} is already an active contact` });
        }
        seen.set(key, i);
      });
    }),
});
export type WizardContactsStepInput = z.infer<typeof wizardContactsStepSchema>;

export const wizardHandoffStepSchema = z.object({
  notesForOnboarding: z.string().trim().max(2000).nullable(),
  onboardingManagerId: z.string().trim().min(1, "Select an Onboarding Manager"),
});
export type WizardHandoffStepInput = z.infer<typeof wizardHandoffStepSchema>;

// The full submit payload (brief 3.8.2 "Create customer"). Factory for
// the same reason as createWizardEntitySchema/createWizardProductsStepSchema
// above — keeps this whole module safe to import from client components.
export function createCustomerSchema(params: { validBicCountryCodes: ReadonlySet<string>; sepaCountries: readonly string[] }) {
  return z.object({
    entity: createWizardEntitySchema(params.validBicCountryCodes),
    duplicateAck: duplicateAckSchema.nullable(),
    products: createWizardProductsStepSchema(params.sepaCountries),
    contacts: wizardContactsStepSchema,
    handoff: wizardHandoffStepSchema,
  });
}
export type CreateCustomerInput = z.infer<ReturnType<typeof createCustomerSchema>>;
