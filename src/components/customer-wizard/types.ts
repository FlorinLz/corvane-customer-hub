import type { ContactRole, Currency, EntityType, GleifSource, LeiStatus, Scheme } from "@prisma/client";

export interface GleifSnapshotFields {
  leiStatus: LeiStatus;
  gleifRawStatus: string | null;
  leiNextRenewalDate: string | null;
  gleifCheckedAt: string;
  gleifSource: GleifSource;
  gleifLegalName: string | null;
  gleifCountry: string | null;
  gleifDirectParentLei: string | null;
  gleifDirectParentName: string | null;
  gleifUltimateParentLei: string | null;
  gleifUltimateParentName: string | null;
  gleifSuccessorLei: string | null;
}

export interface GleifLookupResponse {
  kind: "found" | "not_found" | "unavailable";
  source: "LIVE" | "CACHE" | null;
  fetchedAt: string | null;
  record: {
    lei: string;
    legalName: string;
    legalAddressCountry: string;
    headquartersCountry: string;
    registrationStatus: string;
    nextRenewalDate: string;
    entityStatus: string;
    successorLei: string | null;
    directParent: { lei: string; legalName: string; country: string } | null;
    ultimateParent: { lei: string; legalName: string; country: string } | null;
  } | null;
  fields: GleifSnapshotFields;
  groupSuggestion: { id: string; name: string } | null;
  parentLegalName: string | null;
}

export interface DuplicateMatch {
  entityId: string;
  reason: "LEI" | "BIC" | "NAME";
  legalName: string;
  country: string | null;
  lei: string | null;
  hasCustomerRole: boolean;
  hasPartnerRole: boolean;
  ownerName: string | null;
  ownerTeam: string | null;
  lifecycleState: string;
  deletedAt: string | null;
  addCustomerRoleCandidate: boolean;
}

export interface EntityState {
  lei: string;
  legalName: string;
  country: string;
  type: EntityType | "";
  groupId: string | null;
  groupSuggested: boolean;
  bics: string[];
  aliases: string[];
  gleif: GleifSnapshotFields | null;
  gleifLookup: GleifLookupResponse | null;
  confirmDuplicate: boolean;
  duplicateReason: string;
}

export interface ProductLineState {
  product: Scheme | "";
  country: string;
  contractingEntityId: string;
  targetGoLive: string;
}

export interface VolumeTierState {
  fromVolume: number;
  toVolume: number | null;
  pricePerVerification: number | "";
}

export interface ProductsState {
  productLines: ProductLineState[];
  currency: Currency;
  pricePerVerification: number | "";
  volumeTiers: VolumeTierState[];
  monthlyMinimum: number | "";
  paymentTermDays: number | "";
  availabilityPct: number | "";
  maxResponseMs: number | "";
  slaOther: string;
  specialTerms: string;
}

export interface ContactState {
  role: ContactRole;
  fullName: string;
  email: string;
  phone: string;
  timeZone: string;
  available24x7: boolean;
  fromDay: number;
  toDay: number;
  start: string;
  end: string;
  jobTitle: string;
}

export interface ContactsState {
  contacts: ContactState[];
}

export interface HandoffState {
  notesForOnboarding: string;
  onboardingManagerId: string;
}

export type FieldErrors = Record<string, string[]>;
