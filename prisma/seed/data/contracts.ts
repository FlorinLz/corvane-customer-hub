// Brief 7.1.4 (customer role cards) and 7.1.5 (contracts and partner agreements).
export interface SeedContract {
  contractId: string;
  title: string;
  scope: "ENTITY_CONTRACT" | "GROUP_MASTER_AGREEMENT";
  signingOffset: number;
  invoicedEntity: string; // entity key
  appliesTo: string[]; // entity keys whose CustomerRole.contractId points here
  groupKey?: string; // set for GROUP_MASTER_AGREEMENT
  path: string;
}

export const CUSTOMER_CONTRACTS: SeedContract[] = [
  {
    contractId: "IPE-MSA-2026-014", title: "Santander Group master services agreement",
    scope: "GROUP_MASTER_AGREEMENT", signingOffset: -270, invoicedEntity: "totta",
    appliesTo: ["santanderUk", "totta", "scbPt"], groupKey: "santander",
    path: "santander/msa-2026-014.pdf",
  },
  {
    contractId: "IPE-IT-2026-022", title: "Santander Consumer Bank S.p.A. local services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -240, invoicedEntity: "scbIt", appliesTo: ["scbIt"],
    path: "santander/scb-it-2026-022.pdf",
  },
  {
    contractId: "IPE-GB-2025-007", title: "Lloyds Bank plc verification services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -410, invoicedEntity: "lloyds", appliesTo: ["lloyds"],
    path: "lloyds/customer-2025-007.pdf",
  },
  {
    contractId: "IPE-IT-2025-003", title: "MPS verification services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -385, invoicedEntity: "mps", appliesTo: ["mps"],
    path: "mps/customer-2025-003.pdf",
  },
  {
    contractId: "IPE-NL-2024-011", title: "Adyen N.V. services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -725, invoicedEntity: "adyen", appliesTo: ["adyen"],
    path: "adyen/customer-2024-011.pdf",
  },
  {
    contractId: "IPE-GB-2026-002", title: "Revolut Ltd verification services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -210, invoicedEntity: "revolut", appliesTo: ["revolut"],
    path: "revolut/customer-2026-002.pdf",
  },
  {
    contractId: "IPE-GB-2026-027", title: "Monzo Bank Ltd verification services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -32, invoicedEntity: "monzo", appliesTo: ["monzo"],
    path: "monzo/customer-2026-027.pdf",
  },
  {
    contractId: "IPE-FI-2026-004", title: "Nordea Bank Abp services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -265, invoicedEntity: "nordea", appliesTo: ["nordea"],
    path: "nordea/customer-2026-004.pdf",
  },
  {
    contractId: "IPE-DE-2026-012", title: "ING-DiBa AG services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -228, invoicedEntity: "ingdiba", appliesTo: ["ingdiba"],
    path: "ingdiba/customer-2026-012.pdf",
  },
  {
    contractId: "IPE-CZ-2026-019", title: "Česká spořitelna services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -12, invoicedEntity: "ceska", appliesTo: ["ceska"],
    path: "ceska/customer-2026-019.pdf",
  },
  {
    contractId: "IPE-AT-2025-006", title: "Raiffeisen Bank International services agreement",
    scope: "ENTITY_CONTRACT", signingOffset: -605, invoicedEntity: "rbi", appliesTo: ["rbi"],
    path: "rbi/customer-2025-006.pdf",
  },
];

export interface SeedPartnerAgreement {
  contractId: string;
  entity: string; // entity key
  title: string;
  signingOffset: number;
  path: string;
}

export const PARTNER_AGREEMENTS: SeedPartnerAgreement[] = [
  { contractId: "IPE-PA-2025-003", entity: "lloyds", title: "Lloyds Bank plc network partner agreement", signingOffset: -245, path: "lloyds/partner-agreement.pdf" },
  { contractId: "IPE-PA-2025-009", entity: "totta", title: "Banco Santander Totta network partner agreement", signingOffset: -130, path: "santander/totta-partner-2025-009.pdf" },
  { contractId: "IPE-PA-2024-011", entity: "adyen", title: "Adyen network partner agreement", signingOffset: -330, path: "adyen/partner-2024-011.pdf" },
  { contractId: "IPE-PA-2026-015", entity: "ingdiba", title: "ING-DiBa network partner agreement", signingOffset: -160, path: "ingdiba/partner-2026-015.pdf" },
  { contractId: "IPE-PA-2026-001", entity: "ocbc", title: "OCBC network partner agreement", signingOffset: -110, path: "ocbc/partner-2026-001.pdf" },
  { contractId: "IPE-PA-2026-004", entity: "boi", title: "Bank of Ireland network partner agreement", signingOffset: -70, path: "boi/partner-2026-004.pdf" },
];

export interface VolumeTierSeed {
  fromVolume: number;
  toVolume: number | null;
  pricePerVerification: string;
}

export interface CustomerRoleCard {
  entity: string; // entity key
  contractId: string | null; // null = "No contract attached"
  renewalOffset: number | null;
  slaAvailabilityPct: string | null;
  slaMaxResponseMs: number | null;
  slaOther: string | null;
  specialTerms: string | null;
  notesForOnboarding: string | null;
  currency: "EUR" | "GBP" | "USD" | null;
  pricePerVerification: string | null;
  tiers: VolumeTierSeed[];
  monthlyMinimum: string | null;
  paymentTermDays: number | null;
}

export const CUSTOMER_ROLE_CARDS: CustomerRoleCard[] = [
  {
    entity: "santanderUk", contractId: "IPE-MSA-2026-014", renewalOffset: 300,
    slaAvailabilityPct: "99.95", slaMaxResponseMs: 800, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "GBP", pricePerVerification: "0.0350",
    tiers: [{ fromVolume: 0, toVolume: 1_000_000, pricePerVerification: "0.0350" }, { fromVolume: 1_000_001, toVolume: null, pricePerVerification: "0.0300" }],
    monthlyMinimum: "2000.00", paymentTermDays: 30,
  },
  {
    entity: "totta", contractId: "IPE-MSA-2026-014", renewalOffset: 270,
    slaAvailabilityPct: "99.95", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: "1500.00", paymentTermDays: 30,
  },
  {
    entity: "scbIt", contractId: "IPE-IT-2026-022", renewalOffset: 200,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null,
    specialTerms: "Pilot pricing for first 3 months in IT", notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0420", tiers: [],
    monthlyMinimum: null, paymentTermDays: 45,
  },
  {
    entity: "scbPt", contractId: "IPE-MSA-2026-014", renewalOffset: null,
    slaAvailabilityPct: null, slaMaxResponseMs: null, slaOther: null, specialTerms: null,
    notesForOnboarding: "Group MSA applies. LEI renewal pending at GLEIF, Compliance informed.",
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "lloyds", contractId: "IPE-GB-2025-007", renewalOffset: 400,
    slaAvailabilityPct: "99.95", slaMaxResponseMs: 1000, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "GBP", pricePerVerification: "0.0300",
    tiers: [{ fromVolume: 0, toVolume: 2_000_000, pricePerVerification: "0.0300" }, { fromVolume: 2_000_001, toVolume: null, pricePerVerification: "0.0250" }],
    monthlyMinimum: "3000.00", paymentTermDays: 30,
  },
  {
    entity: "mps", contractId: "IPE-IT-2025-003", renewalOffset: 75,
    slaAvailabilityPct: "99.95", slaMaxResponseMs: null, slaOther: "Monthly service report by the 5th business day",
    specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0380",
    tiers: [{ fromVolume: 0, toVolume: 500_000, pricePerVerification: "0.0380" }, { fromVolume: 500_001, toVolume: null, pricePerVerification: "0.0320" }],
    monthlyMinimum: "1000.00", paymentTermDays: 60,
  },
  {
    entity: "zopa", contractId: null, renewalOffset: 330,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "GBP", pricePerVerification: "0.0450", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "hvb", contractId: null, renewalOffset: -10,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "adyen", contractId: "IPE-NL-2024-011", renewalOffset: 100,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0450", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "revolut", contractId: "IPE-GB-2026-002", renewalOffset: 250,
    slaAvailabilityPct: "99.95", slaMaxResponseMs: 500, slaOther: null,
    specialTerms: "Weekly status call during EU VoP DE onboarding", notesForOnboarding: null,
    currency: "GBP", pricePerVerification: "0.0280",
    tiers: [{ fromVolume: 0, toVolume: 5_000_000, pricePerVerification: "0.0280" }, { fromVolume: 5_000_001, toVolume: null, pricePerVerification: "0.0220" }],
    monthlyMinimum: "5000.00", paymentTermDays: 30,
  },
  {
    entity: "monzo", contractId: "IPE-GB-2026-027", renewalOffset: 250,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "GBP", pricePerVerification: "0.0300", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "nordea", contractId: "IPE-FI-2026-004", renewalOffset: 260,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "ingdiba", contractId: "IPE-DE-2026-012", renewalOffset: 180,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0380", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "ceska", contractId: "IPE-CZ-2026-019", renewalOffset: 365,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "rbi", contractId: "IPE-AT-2025-006", renewalOffset: -60,
    slaAvailabilityPct: "99.90", slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: "EUR", pricePerVerification: "0.0400", tiers: [],
    monthlyMinimum: null, paymentTermDays: 30,
  },
  {
    entity: "lloydsLegacy", contractId: null, renewalOffset: null,
    slaAvailabilityPct: null, slaMaxResponseMs: null, slaOther: null, specialTerms: null, notesForOnboarding: null,
    currency: null, pricePerVerification: null, tiers: [],
    monthlyMinimum: null, paymentTermDays: null,
  },
];
