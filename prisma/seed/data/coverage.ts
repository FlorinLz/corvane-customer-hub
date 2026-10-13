// Brief 7.1.7. All coverage changes are by Lukas Brenner (Network). Reasons
// not given explicitly in the brief default to the pattern the given ones
// establish: "Initial coverage" for a first Onboarding row, "Go-live
// completed" for an Onboarding -> Active move.
export interface SeedCoverageChange {
  status: "ONBOARDING" | "ACTIVE" | "DEGRADED" | "SUSPENDED" | "RETIRED";
  effectiveOffset: number;
  reason: string;
}

export interface SeedCoverageRow {
  country: string;
  scheme: "EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION";
  changes: SeedCoverageChange[];
}

export interface SeedPartnerRole {
  entity: string;
  connectionMethod: "DIRECT" | "VIA_SCHEME" | "VIA_ROUTING_PROVIDER";
  providerName: string | null;
  coverage: SeedCoverageRow[];
}

export const PARTNER_ROLES: SeedPartnerRole[] = [
  {
    entity: "lloyds", connectionMethod: "DIRECT", providerName: null,
    coverage: [
      {
        country: "GB", scheme: "UK_COP",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -120, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -20, reason: "Certification passed" },
        ],
      },
      {
        country: "GB", scheme: "GLOBAL_VALIDATION",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -240, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -200, reason: "Go-live completed" },
        ],
      },
      {
        country: "IE", scheme: "GLOBAL_VALIDATION",
        changes: [{ status: "ONBOARDING", effectiveOffset: -15, reason: "Initial coverage" }],
      },
    ],
  },
  {
    entity: "totta", connectionMethod: "VIA_SCHEME", providerName: null,
    coverage: [
      {
        country: "PT", scheme: "EU_VOP",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -130, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -90, reason: "Go-live completed" },
        ],
      },
    ],
  },
  {
    entity: "adyen", connectionMethod: "VIA_ROUTING_PROVIDER", providerName: "ClearRoute Services",
    coverage: [
      {
        country: "NL", scheme: "GLOBAL_VALIDATION",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -330, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -300, reason: "Go-live completed" },
        ],
      },
      {
        country: "NL", scheme: "EU_VOP",
        changes: [{ status: "ONBOARDING", effectiveOffset: -20, reason: "Initial coverage" }],
      },
    ],
  },
  {
    entity: "ingdiba", connectionMethod: "VIA_SCHEME", providerName: null,
    coverage: [
      {
        country: "DE", scheme: "EU_VOP",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -160, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -150, reason: "Go-live completed" },
        ],
      },
    ],
  },
  {
    entity: "ocbc", connectionMethod: "DIRECT", providerName: null,
    coverage: [
      {
        country: "SG", scheme: "GLOBAL_VALIDATION",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -110, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -100, reason: "Go-live completed" },
        ],
      },
    ],
  },
  {
    entity: "boi", connectionMethod: "VIA_ROUTING_PROVIDER", providerName: "ClearRoute Services",
    coverage: [
      {
        country: "IE", scheme: "GLOBAL_VALIDATION",
        changes: [
          { status: "ONBOARDING", effectiveOffset: -70, reason: "Initial coverage" },
          { status: "ACTIVE", effectiveOffset: -60, reason: "Go-live completed" },
        ],
      },
    ],
  },
];

/** Partner role creation date = the partner agreement signing date (7.1.5), where one exists. */
export const PARTNER_ROLE_CREATED_OFFSET: Record<string, number> = {
  lloyds: -245,
  totta: -130,
  adyen: -330,
  ingdiba: -160,
  ocbc: -110,
  boi: -70,
};
