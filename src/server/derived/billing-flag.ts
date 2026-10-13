import { LifecycleState } from "@prisma/client";

import { isValidLei, normaliseLei } from "@/lib/validation/lei";
import { checkVat, normaliseVat } from "@/lib/validation/vat";
import { CORVANE_CONTRACTING_ENTITIES } from "@/server/config";

export interface BillingProfileFields {
  billingLegalName: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  vatId: string | null;
  lei: string | null;
  contractingEntity: string | null;
}

export interface BillingFlagInput {
  hasActiveCustomerRole: boolean;
  lifecycle: LifecycleState;
  isDeleted: boolean;
  /** true when the applicable contract has no invoicedEntityId, or names this entity; false when it names another entity (M4 AC9, M14 AC15). */
  isOwnInvoicedEntity: boolean;
  billedThroughEntityName: string | null;
  profile: BillingProfileFields | null;
  /** The applicable contract's display ID, or null for "No contract attached". */
  contractReference: string | null;
  hasPartnerRole: boolean;
}

export interface BillingFlagResult {
  /** AC6: whether the flag mechanism applies to this entity at all. */
  applies: boolean;
  billedThrough: string | null;
  partnerOnly: boolean;
  missingFields: string[];
  invalidFields: string[];
  incomplete: boolean;
}

const EMPTY_RESULT: Omit<BillingFlagResult, "applies" | "billedThrough" | "partnerOnly"> = {
  missingFields: [],
  invalidFields: [],
  incomplete: false,
};

/** Brief M14 AC6, AC7, AC15; 3.2.4 "Billing flag". Computed at read time, never stored. */
export function computeBillingFlag(input: BillingFlagInput): BillingFlagResult {
  if (!input.hasActiveCustomerRole) {
    return { applies: false, billedThrough: null, partnerOnly: input.hasPartnerRole, ...EMPTY_RESULT };
  }
  if (input.lifecycle === LifecycleState.INACTIVE || input.isDeleted) {
    return { applies: false, billedThrough: null, partnerOnly: false, ...EMPTY_RESULT };
  }
  if (!input.isOwnInvoicedEntity) {
    return { applies: false, billedThrough: input.billedThroughEntityName, partnerOnly: false, ...EMPTY_RESULT };
  }

  const missing: string[] = [];
  const invalid: string[] = [];
  const p = input.profile;

  function check(label: string, value: string | null, isValid?: (v: string) => boolean) {
    if (!value) {
      missing.push(label);
      return;
    }
    if (isValid && !isValid(value)) invalid.push(label);
  }

  check("Billing legal name", p?.billingLegalName ?? null);
  check("Street", p?.street ?? null);
  check("City", p?.city ?? null);
  check("Postal code", p?.postalCode ?? null);
  check("Country", p?.country ?? null);
  check("VAT / tax ID", p?.vatId ?? null, (v) => checkVat(normaliseVat(v), p?.country ?? null) === null);
  check("LEI", p?.lei ?? null, (v) => isValidLei(normaliseLei(v)));
  check(
    "Contracting Corvane entity",
    p?.contractingEntity ?? null,
    (v) => (CORVANE_CONTRACTING_ENTITIES as readonly string[]).includes(v),
  );
  check("Contract reference", input.contractReference);

  return {
    applies: true,
    billedThrough: null,
    partnerOnly: false,
    missingFields: missing,
    invalidFields: invalid,
    incomplete: missing.length + invalid.length > 0,
  };
}
