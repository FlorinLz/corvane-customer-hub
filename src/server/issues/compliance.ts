import type { IssueType, RegulatoryRegime, Severity } from "@prisma/client";

import { REGULATORY_REGIME_LABELS } from "@/lib/labels";

// Brief 4.9.9. The flagging-reasons pure function only (M25, M26's own
// assessor-choice algorithm and the assessment-recording service belong
// to milestone 6C -- the seed inserts ISS-1042's ComplianceAssessment
// row as literal data, not computed).

export interface ComplianceCard {
  regulatoryRegime: RegulatoryRegime | null;
}

export interface ComplianceIssue {
  possibleBreach: boolean;
  type: IssueType;
  severity: Severity;
}

function regimeLabel(card: ComplianceCard): string {
  return card.regulatoryRegime ? REGULATORY_REGIME_LABELS[card.regulatoryRegime] : "";
}

/** Shown as "Flagged for Compliance: <reason>". The caller sets complianceFlaggedAt on the first non-empty result and never removes the flag once set (M25 edge cases 1, 3). */
export function complianceReasons(issue: ComplianceIssue, card: ComplianceCard | null, isPartnerIssue: boolean): string[] {
  const r: string[] = [];
  if (issue.possibleBreach || issue.type === "DATA_BREACH_SECURITY") r.push("possible data breach reported");
  if (!isPartnerIssue && issue.severity === "SEV1") {
    const regime = card?.regulatoryRegime ?? null;
    if (regime === null) r.push("Sev-1, regulatory regime not captured");
    else if (regime !== "NONE") r.push(`Sev-1 at a regulated customer (${regimeLabel(card!)})`);
  }
  return r;
}
