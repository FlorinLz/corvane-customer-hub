import type { Issue, Prisma } from "@prisma/client";

import { ISSUE_STATUS_LABELS, issueDisplayId } from "@/lib/labels";
import type { AuditLogger } from "@/server/audit/mutate";

/**
 * The issue closes only when every step is done: the resolution confirmed with the customer (or partner), the customer notified where
 * that is required, the Compliance assessment recorded where the issue is flagged, and the root cause report sent where there is one.
 * Called after each of those steps; it closes the issue when the one just recorded was the last. Returns the closed issue, or null when steps remain.
 */
export async function closeWhenAllStepsDone(tx: Prisma.TransactionClient, log: AuditLogger, issueId: string, userId: string, t: Date): Promise<Issue | null> {
  const issue = await tx.issue.findUnique({
    where: { id: issueId },
    select: {
      number: true,
      status: true,
      notifyRequired: true,
      severity: true,
      notifiedAt: true,
      complianceFlaggedAt: true,
      complianceClosedAt: true,
      assessments: { select: { id: true }, take: 1 },
      rootCauseTask: { select: { sentAt: true } },
      communications: { where: { type: "CLOSURE_CONFIRMED" }, select: { id: true }, take: 1 },
    },
  });
  if (!issue || issue.status !== "RESOLVED") return null;
  const confirmed = issue.communications.length > 0;
  const notified = !issue.notifyRequired || (issue.severity !== "SEV1" && issue.severity !== "SEV2") || !!issue.notifiedAt;
  const assessed = !issue.complianceFlaggedAt || issue.assessments.length > 0 || !!issue.complianceClosedAt;
  const reportSent = !issue.rootCauseTask || !!issue.rootCauseTask.sentAt;
  if (!(confirmed && notified && assessed && reportSent)) return null;

  const closed = await tx.issue.update({ where: { id: issueId }, data: { status: "CLOSED", closedAt: t, closedById: userId, version: { increment: 1 } } });
  await log.change({
    objectType: "ISSUE",
    objectId: issueId,
    objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
    fields: [{ field: "Status", oldValue: ISSUE_STATUS_LABELS.RESOLVED, newValue: ISSUE_STATUS_LABELS.CLOSED }],
  });
  await log.history({ category: "INCIDENT", issueId, summary: `${issueDisplayId(issue.number)} closed: every step is done` });
  return closed;
}
