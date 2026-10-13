import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { RegulatoryRegime } from "@prisma/client";

import { formatInZone } from "@/lib/time-zones";
import { ASSESSMENT_OUTCOME_LABELS, TEAM_LABELS } from "@/lib/labels";
import { RecordAssessmentDialog } from "@/components/issues/RecordAssessmentDialog";

export interface AssessmentRow {
  id: string;
  outcome: string;
  rationale: string;
  assessedByName: string;
  assessedAt: Date;
}

/** Brief 4.9.9, M25. Full build: flag reasons, the "not flagged"/"nothing captured" states, assessor, assessment clock and history, Record assessment (Compliance only). */
export function CompliancePanel({
  issueId,
  entityId,
  severity,
  reasons,
  regime,
  hasCard,
  isPartnerIssue,
  clockText,
  assessorName,
  isCompliance,
  issueClosed,
  assessments,
  viewerZone,
}: {
  issueId: string;
  entityId: string;
  severity: string;
  reasons: string[];
  regime: RegulatoryRegime | null | undefined;
  hasCard: boolean;
  /** A partner issue reads no Customer agreement card, so "No Customer agreement card on file" never applies to it. */
  isPartnerIssue: boolean;
  clockText: string | null;
  assessorName: string | null;
  isCompliance: boolean;
  /** The ISSUE's own status: AC8 allows a new assessment any time the issue itself isn't Closed, even after an earlier "Neither" (that only sets `complianceClosedAt`, a different, sticky flag-history marker). */
  issueClosed: boolean;
  assessments: AssessmentRow[];
  viewerZone: string;
}) {
  const flagged = reasons.length > 0;
  // AC3: the block also renders, unflagged, when the Sev-1-regulated-customer
  // check actually applied and came back negative ("None" regime, no breach).
  const relevant = flagged || severity === "SEV1";
  if (!relevant) return null;

  const incompleteCard = reasons.includes("Sev-1, regulatory regime not captured");
  const latest = assessments[0] ?? null;
  const noCardLine = !isPartnerIssue && !hasCard && !incompleteCard && !flagged && regime !== "NONE";
  // Nothing to show (no flag, no assessment, none of the notes below): no card, not an empty one.
  if (!flagged && assessments.length === 0 && regime !== "NONE" && !incompleteCard && !noCardLine) return null;

  return (
    <section aria-label="Compliance" className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-subsection">Compliance</h3>

      {flagged ? (
        <div className="flex items-center gap-2 text-danger">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <span className="font-medium">Flagged for Compliance: {reasons.join("; ")}</span>
        </div>
      ) : regime === "NONE" ? (
        <p className="text-body">Not flagged: customer recorded as not regulated</p>
      ) : null}

      {incompleteCard && (
        <p className="text-meta text-text-secondary">
          Complete the Customer agreement card: regulatory regime not captured.{" "}
          <Link href={`/entities/${entityId}/compliance`} className="text-link-text hover:underline">
            Go to Compliance
          </Link>
        </p>
      )}
      {noCardLine && <p className="text-meta text-text-secondary">No Customer agreement card on file.</p>}

      {flagged && (
        <>
          <p className="text-meta text-text-secondary">Assessor: {assessorName ?? "—"}</p>
          {latest?.outcome === "NEITHER" ? (
            <p className="text-body">Assessed: neither. No regulatory clock started.</p>
          ) : latest ? (
            <p className="text-body">
              {ASSESSMENT_OUTCOME_LABELS[latest.outcome as keyof typeof ASSESSMENT_OUTCOME_LABELS]}. Assessed by {latest.assessedByName} (Compliance) at {formatInZone(latest.assessedAt, viewerZone)}.
            </p>
          ) : (
            clockText && <p className="text-body">{clockText}</p>
          )}

          {isCompliance && !issueClosed && <RecordAssessmentDialog issueId={issueId} />}

          {assessments.length > 0 && (
            <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
              <span className="text-meta font-medium text-text-secondary">Assessment history</span>
              {assessments.map((a) => (
                <div key={a.id} className="flex flex-col gap-0.5 text-meta">
                  <span className="font-medium text-text">
                    {ASSESSMENT_OUTCOME_LABELS[a.outcome as keyof typeof ASSESSMENT_OUTCOME_LABELS]} · {a.assessedByName} ({TEAM_LABELS.COMPLIANCE}) · {formatInZone(a.assessedAt, viewerZone)}
                  </span>
                  <p className="text-text-secondary">{a.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
