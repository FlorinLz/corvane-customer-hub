import { createFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { now } from "@/lib/dates";
import { ASSESSMENT_OUTCOME_LABELS, issueDisplayId } from "@/lib/labels";
import type { RecordAssessmentInput } from "@/lib/validation/issues";
import { requireIssueEntity } from "@/server/issues/roles";
import { closeWhenAllStepsDone } from "@/server/issues/close-when-done";
import { NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/permissions/can";

/** Brief M25 AC6-AC8, AC11. Any Compliance user -- not "the assigned assessor only" (no such identity check in the brief). */
export async function recordComplianceAssessment(user: SessionUser, issueId: string, input: RecordAssessmentInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.compliance");

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    // Open or Resolved: allowed. A regulated bank's reporting duty does not end when the fix lands. Only an issue closed with the customer blocks it.
    if (issue.status === "CLOSED") {
      throw new ValidationError({ outcome: ["This issue is closed with the customer"] });
    }

    const t = now();
    const assessment = await tx.complianceAssessment.create({
      data: { issueId: issue.id, outcome: input.outcome, rationale: input.rationale, assessedById: user.id, assessedAt: t },
    });

    if (input.outcome === "NEITHER" && !issue.complianceClosedAt) {
      await tx.issue.update({ where: { id: issue.id }, data: { complianceClosedAt: t } });
    }

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ Outcome: ASSESSMENT_OUTCOME_LABELS[input.outcome], Rationale: input.rationale }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Compliance assessment: ${ASSESSMENT_OUTCOME_LABELS[input.outcome]}. By ${user.name}, Compliance.`,
    });
    // An assessment recorded after the resolution and the customer's confirmation can be the last step.
    await closeWhenAllStepsDone(tx, log, issue.id, user.id, t);

    return assessment;
  });
}
