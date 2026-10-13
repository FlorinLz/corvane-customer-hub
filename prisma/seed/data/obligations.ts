// Brief 7.1.12. One card per role. Links: https://docs.corvane-internal.example/<entity>/<role>-agreement.pdf.
// "Last updated by" = Mei Chen at the date shown, for every card.
// Regulatory block (7.1.17.6, M26 AC10): Customer agreement cards only; a Partner
// agreement card always carries null regulatory fields (M26 AC1). `postIncidentReportDays`
// (R2) is seeded now but not rendered until milestone 12A (M26 AC9).
export interface SeedObligation {
  entity: string;
  kind: "CUSTOMER_AGREEMENT" | "PARTNER_AGREEMENT";
  incidentNoticeHours: number | null;
  subprocessorNoticeDays: number | null;
  auditRight: boolean | null;
  availabilitySlaPct: string | null;
  euVopStatus: "NOT_APPLICABLE" | "NOT_STARTED" | "IN_PROGRESS" | "ADHERED" | "SUSPENDED" | "WITHDRAWN" | null;
  ukCopStatus: "NOT_APPLICABLE" | "NOT_STARTED" | "IN_PROGRESS" | "ADHERED" | "SUSPENDED" | "WITHDRAWN" | null;
  expiryOffset: number | null;
  hasLink: boolean;
  updatedOffset: number;
  regulatoryRegime?: "EU_DORA" | "UK_FCA" | "UNITED_STATES" | "SINGAPORE_MAS" | "UAE_CBUAE" | "OTHER" | "NONE" | null;
  regimeName?: string | null;
  regulatorDeadline?: string | null;
  factsNeededHours?: number | null;
  postIncidentReportDays?: number | null;
}

const DORA_DEADLINE = "DORA: initial notification within 4 hours of classification, at the latest 24 hours after detection";
const FCA_DEADLINE = "FCA: notify as soon as aware of a material operational incident";

export const OBLIGATIONS: SeedObligation[] = [
  { entity: "revolut", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 2, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "ADHERED", ukCopStatus: "ADHERED", expiryOffset: 520, hasLink: true, updatedOffset: -190, regulatoryRegime: "UK_FCA", regulatorDeadline: FCA_DEADLINE, factsNeededHours: 4, postIncidentReportDays: 14 },
  { entity: "santanderUk", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 4, subprocessorNoticeDays: 60, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "ADHERED", expiryOffset: 700, hasLink: true, updatedOffset: -250, regulatoryRegime: "UK_FCA", regulatorDeadline: FCA_DEADLINE, factsNeededHours: 4, postIncidentReportDays: 30 },
  { entity: "lloyds", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 90, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "ADHERED", expiryOffset: 400, hasLink: true, updatedOffset: -390, regulatoryRegime: "UK_FCA", regulatorDeadline: FCA_DEADLINE, factsNeededHours: 4, postIncidentReportDays: 14 },
  { entity: "zopa", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: null, subprocessorNoticeDays: 30, auditRight: false, availabilitySlaPct: "99.50", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "IN_PROGRESS", expiryOffset: 330, hasLink: true, updatedOffset: -55, regulatoryRegime: null, regulatorDeadline: null, factsNeededHours: null, postIncidentReportDays: null },
  { entity: "lloyds", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 1, subprocessorNoticeDays: 60, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "ADHERED", expiryOffset: 545, hasLink: true, updatedOffset: -240 },
  { entity: "monzo", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 12, subprocessorNoticeDays: 0, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 700, hasLink: true, updatedOffset: -28, regulatoryRegime: null, regulatorDeadline: null, factsNeededHours: null, postIncidentReportDays: null },
  { entity: "adyen", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 4, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -700, regulatoryRegime: "EU_DORA", regulatorDeadline: DORA_DEADLINE, factsNeededHours: 2, postIncidentReportDays: 20 },
  { entity: "adyen", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 4, subprocessorNoticeDays: null, auditRight: true, availabilitySlaPct: null, euVopStatus: "IN_PROGRESS", ukCopStatus: "NOT_APPLICABLE", expiryOffset: null, hasLink: true, updatedOffset: -320 },
  { entity: "mps", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 6, subprocessorNoticeDays: 60, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 75, hasLink: true, updatedOffset: -375, regulatoryRegime: "EU_DORA", regulatorDeadline: DORA_DEADLINE, factsNeededHours: 2, postIncidentReportDays: 20 },
  { entity: "hvb", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 24, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: -10, hasLink: true, updatedOffset: -495, regulatoryRegime: "EU_DORA", regulatorDeadline: DORA_DEADLINE, factsNeededHours: 2, postIncidentReportDays: 20 },
  { entity: "scbIt", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 6, subprocessorNoticeDays: 45, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 500, hasLink: true, updatedOffset: -230, regulatoryRegime: "NONE" },
  { entity: "totta", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 4, subprocessorNoticeDays: 60, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 700, hasLink: true, updatedOffset: -250, regulatoryRegime: "NONE" },
  { entity: "totta", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 2, subprocessorNoticeDays: 60, auditRight: true, availabilitySlaPct: "99.95", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 600, hasLink: true, updatedOffset: -125 },

  // Fillers: 8 / 30 / Yes / 99.90, EU VoP Adhered when the country is in the EU else Not applicable, UK CoP always Not applicable, expiry +400, updated at creation. Regulatory regime None (7.1.17.6 "other customers").
  { entity: "nordea", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -262, regulatoryRegime: "NONE" },
  { entity: "ingdiba", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -225, regulatoryRegime: "NONE" },
  { entity: "ingdiba", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -225 },
  { entity: "ceska", kind: "CUSTOMER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -10, regulatoryRegime: "NONE" },
  { entity: "ocbc", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "NOT_APPLICABLE", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -110 },
  { entity: "boi", kind: "PARTNER_AGREEMENT", incidentNoticeHours: 8, subprocessorNoticeDays: 30, auditRight: true, availabilitySlaPct: "99.90", euVopStatus: "ADHERED", ukCopStatus: "NOT_APPLICABLE", expiryOffset: 400, hasLink: true, updatedOffset: -70 },
];

/** scbPt, rbi Customer: no card ("No obligations captured yet") — simply absent from OBLIGATIONS above. */
