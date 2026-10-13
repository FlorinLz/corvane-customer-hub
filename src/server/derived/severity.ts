import type { IssueImpact, IssueType, Scheme, Severity, Stage } from "@prisma/client";

import { STAGE_ORDER, STAGE_LABELS, ISSUE_IMPACT_LABELS, SCHEME_LABELS } from "@/lib/labels";

// Brief 4.9.4. Also imported by the report form (6B) for the live
// proposal, so this stays pure (no DB access, no @/server/config --
// that module pulls in i18n-iso-countries at load time, which would
// bundle into client JS the moment anything here got imported
// client-side; see DECISIONS.md): the caller resolves `decidingStage`
// first (brief M17 AC3, M19 AC2-AC3: the selected product line's
// stage; else the most advanced non-cancelled line on the chosen
// scheme+country; else the most advanced among all lines when no
// scheme is chosen; null when the customer has no matching line at
// all) and passes it in here.

/** Brief 3.3.6, M17 AC7, M19 AC1. */
const SEVERITY_FROM_IMPACT: Record<string, Severity> = {
  DOWN: "SEV1",
  DEGRADED: "SEV2",
  ISOLATED_CASE: "SEV3",
  QUESTION_OR_REQUEST: "SEV4",
};

/** Brief 3.3.6, M17 AC9, B26. Types capped at Sev-2 (no on-call team), lifted by a possible breach. */
export const TYPE_SEVERITY_CAP: Partial<Record<IssueType, Severity>> = {
  BILLING: "SEV2",
  COMMERCIAL_COVERAGE: "SEV2",
};
export interface ProposeSeverityInput {
  impact: IssueImpact;
  possibleBreach: boolean;
  type: IssueType;
  decidingStage: Stage | null;
  customerRole: boolean; // false for a partner-only entity: never capped (M17 edge case 1)
  scheme?: Scheme | null;
  country?: string | null;
}

export interface ProposedSeverity {
  severity: Severity;
  rule: string; // "Down", "Possible data breach", etc. -- the proposal's reason label
  capLabel: string | null; // stored verbatim in Issue.severityCapLabel
}

/** SEV1 = 1 (most severe) ... SEV4 = 4 (least severe); a lower number never gets weakened by a cap. */
export function severityRank(s: Severity): number {
  return Number(s.slice(3));
}

/** "7" in the brief's own "3.3.1: 7 = Live & hypercare" is 1-based: STAGE_ORDER's 0-based index + 1. */
function stageNumber(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage) + 1;
}

function preGoLiveLabel(scheme: Scheme | null | undefined, country: string | null | undefined, decidingStage: Stage | null): string {
  const target = scheme && country ? `${SCHEME_LABELS[scheme]} / ${country}` : null;
  if (decidingStage === null) {
    return target ? `Sev-3 maximum before go-live: no live product on ${target}` : "Sev-3 maximum before go-live: no live product";
  }
  return target
    ? `Sev-3 maximum before go-live: ${target} is at ${STAGE_LABELS[decidingStage]}`
    : `Sev-3 maximum before go-live: at ${STAGE_LABELS[decidingStage]}`;
}

export function proposeSeverity(i: ProposeSeverityInput): ProposedSeverity {
  if (i.possibleBreach) return { severity: "SEV1", rule: "Possible data breach", capLabel: null }; // B25: overrides every cap

  let s = SEVERITY_FROM_IMPACT[i.impact];
  let capLabel: string | null = null;

  const typeCap = TYPE_SEVERITY_CAP[i.type];
  if (typeCap && severityRank(s) < severityRank(typeCap)) {
    s = typeCap;
    capLabel = "Highest severity for this type: Sev-2";
  }

  const preGoLive = i.customerRole && (i.decidingStage === null || stageNumber(i.decidingStage) < 7);
  if (preGoLive && severityRank(s) < severityRank("SEV3")) {
    s = "SEV3";
    capLabel = preGoLiveLabel(i.scheme, i.country, i.decidingStage);
  }

  return { severity: s, rule: ISSUE_IMPACT_LABELS[i.impact], capLabel };
}
