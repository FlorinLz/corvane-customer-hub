// Brief 7.1.6. Contracting entity = the entity itself on every line.
// `addedByAdrian`: lines added after the wizard were added by Adrian Koh
// with "Add product line" (M6 AC18); otherwise added by the entity's
// Sales creator at wizard submission time.
export type SeedStage =
  | "CONTRACT_SIGNED" | "KICKOFF" | "SANDBOX_TECHNICAL_INTEGRATION" | "TESTING_CERTIFICATION"
  | "UAT" | "GO_LIVE_APPROVAL" | "LIVE_HYPERCARE" | "RAMP_UP" | "BAU";

export interface SeedBlock {
  setOffset: number;
  blockedBy: "CUSTOMER" | "INTERNAL" | "PARTNER";
  reason: string;
  resolvedOffset?: number; // present = resolved; absent = still open
}

export interface SeedProduct {
  key: string;
  entity: string;
  product: "EU_VOP" | "UK_COP" | "GLOBAL_VALIDATION";
  country: string;
  addedOffset: number;
  addedByAdrian: boolean;
  billableFromOffset: number | null;
  stage: SeedStage;
  stageEnteredOffset: number;
  targetGoLiveOffset: number;
  block?: SeedBlock;
}

export const PRODUCTS: SeedProduct[] = [
  { key: "P1", entity: "santanderUk", product: "UK_COP", country: "GB", addedOffset: -262, addedByAdrian: false, billableFromOffset: -205, stage: "BAU", stageEnteredOffset: -150, targetGoLiveOffset: -210 },
  { key: "P2", entity: "totta", product: "EU_VOP", country: "PT", addedOffset: -257, addedByAdrian: false, billableFromOffset: -90, stage: "RAMP_UP", stageEnteredOffset: -30, targetGoLiveOffset: -95 },
  { key: "P3", entity: "totta", product: "EU_VOP", country: "FR", addedOffset: -120, addedByAdrian: true, billableFromOffset: null, stage: "SANDBOX_TECHNICAL_INTEGRATION", stageEnteredOffset: -38, targetGoLiveOffset: 60 },
  { key: "P4", entity: "scbIt", product: "EU_VOP", country: "IT", addedOffset: -237, addedByAdrian: false, billableFromOffset: -110, stage: "RAMP_UP", stageEnteredOffset: -50, targetGoLiveOffset: -115 },
  { key: "P5", entity: "scbIt", product: "GLOBAL_VALIDATION", country: "IT", addedOffset: -60, addedByAdrian: true, billableFromOffset: null, stage: "UAT", stageEnteredOffset: -10, targetGoLiveOffset: 40 },
  { key: "P6", entity: "scbPt", product: "GLOBAL_VALIDATION", country: "PT", addedOffset: -3, addedByAdrian: false, billableFromOffset: null, stage: "CONTRACT_SIGNED", stageEnteredOffset: -3, targetGoLiveOffset: 59 },
  { key: "P7", entity: "lloyds", product: "UK_COP", country: "GB", addedOffset: -400, addedByAdrian: false, billableFromOffset: -330, stage: "BAU", stageEnteredOffset: -260, targetGoLiveOffset: -335 },
  { key: "P8", entity: "lloyds", product: "GLOBAL_VALIDATION", country: "GB", addedOffset: -40, addedByAdrian: true, billableFromOffset: null, stage: "SANDBOX_TECHNICAL_INTEGRATION", stageEnteredOffset: -12, targetGoLiveOffset: 45 },
  { key: "P9", entity: "mps", product: "EU_VOP", country: "IT", addedOffset: -380, addedByAdrian: false, billableFromOffset: -200, stage: "BAU", stageEnteredOffset: -120, targetGoLiveOffset: -205 },
  { key: "P10", entity: "mps", product: "EU_VOP", country: "DE", addedOffset: -300, addedByAdrian: true, billableFromOffset: -100, stage: "RAMP_UP", stageEnteredOffset: -40, targetGoLiveOffset: -105 },
  {
    key: "P11", entity: "mps", product: "GLOBAL_VALIDATION", country: "DE", addedOffset: -300, addedByAdrian: true,
    billableFromOffset: -25, stage: "LIVE_HYPERCARE", stageEnteredOffset: -25, targetGoLiveOffset: -30,
    block: { setOffset: -70, blockedBy: "CUSTOMER", reason: "Waiting for the customer's firewall change for the DE endpoint", resolvedOffset: -55 },
  },
  { key: "P12", entity: "zopa", product: "UK_COP", country: "GB", addedOffset: -60, addedByAdrian: false, billableFromOffset: null, stage: "UAT", stageEnteredOffset: -15, targetGoLiveOffset: -6 },
  { key: "P13", entity: "hvb", product: "EU_VOP", country: "DE", addedOffset: -500, addedByAdrian: false, billableFromOffset: -400, stage: "BAU", stageEnteredOffset: -330, targetGoLiveOffset: -405 },
  { key: "P14", entity: "adyen", product: "GLOBAL_VALIDATION", country: "NL", addedOffset: -720, addedByAdrian: false, billableFromOffset: -560, stage: "BAU", stageEnteredOffset: -480, targetGoLiveOffset: -565 },
  { key: "P15", entity: "revolut", product: "UK_COP", country: "GB", addedOffset: -200, addedByAdrian: false, billableFromOffset: -60, stage: "LIVE_HYPERCARE", stageEnteredOffset: -60, targetGoLiveOffset: -65 },
  {
    key: "P16", entity: "revolut", product: "EU_VOP", country: "DE", addedOffset: -200, addedByAdrian: false,
    billableFromOffset: null, stage: "UAT", stageEnteredOffset: -14, targetGoLiveOffset: 30,
    block: { setOffset: -8, blockedBy: "CUSTOMER", reason: "waiting for production certificates from the customer's security team" },
  },
  { key: "P17", entity: "revolut", product: "GLOBAL_VALIDATION", country: "SG", addedOffset: -150, addedByAdrian: true, billableFromOffset: null, stage: "TESTING_CERTIFICATION", stageEnteredOffset: -10, targetGoLiveOffset: 9 },
  { key: "P18", entity: "monzo", product: "GLOBAL_VALIDATION", country: "GB", addedOffset: -30, addedByAdrian: false, billableFromOffset: null, stage: "KICKOFF", stageEnteredOffset: -9, targetGoLiveOffset: 50 },
  { key: "P19", entity: "nordea", product: "EU_VOP", country: "FI", addedOffset: -262, addedByAdrian: false, billableFromOffset: -235, stage: "BAU", stageEnteredOffset: -220, targetGoLiveOffset: -240 },
  { key: "P20", entity: "ingdiba", product: "EU_VOP", country: "DE", addedOffset: -225, addedByAdrian: false, billableFromOffset: -200, stage: "BAU", stageEnteredOffset: -180, targetGoLiveOffset: -205 },
  { key: "P21", entity: "ceska", product: "GLOBAL_VALIDATION", country: "CZ", addedOffset: -10, addedByAdrian: false, billableFromOffset: null, stage: "KICKOFF", stageEnteredOffset: -5, targetGoLiveOffset: 70 },
  { key: "P22", entity: "rbi", product: "EU_VOP", country: "AT", addedOffset: -600, addedByAdrian: false, billableFromOffset: -520, stage: "BAU", stageEnteredOffset: -460, targetGoLiveOffset: -525 },
];
