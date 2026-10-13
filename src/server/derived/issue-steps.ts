import type { IssueStatus } from "@prisma/client";

import type { ComputedClocks } from "@/server/derived/issue-clocks";

// Brief 4.6.9, M20 AC4. One function shared by the Home "Issues" section
// and the Home badge: given the user's roles on an issue and its
// already-computed clocks (issue-clocks.ts, reused rather than
// recomputed here), returns every R1 step the user must take on it. R2
// rows (Send update, Send facts pack, Notify data breach, Remind
// customer, Send root cause report) are out of scope this milestone.

export interface IssueStep {
  text: string;
  clockText: string | null;
  dueAt: Date | null;
  overdue: boolean;
}

export interface StepsInput {
  status: IssueStatus;
  notifyRequired: boolean;
  severity: "SEV1" | "SEV2" | "SEV3" | "SEV4";
  notifiedAt: Date | null;
  complianceFlaggedAt: Date | null;
  complianceClosedAt: Date | null;
  firstAssessmentAt: Date | null;
  complianceVisibleFrom: Date | null;
  /** The resolution is confirmed with the customer (the partner): that step is done, whatever else is still open. */
  resolutionConfirmed?: boolean;
  /** The root cause report task (M27), when there is one: open until "Record report sent". */
  reportTask?: { dueAt: Date | null; sent: boolean; approved?: boolean; draftShared?: boolean } | null;
}

export interface StepsRoles {
  isOwner: boolean;
  isCommunicator: boolean;
  isComplianceAssessor: boolean;
  /** The Compliance person who reviews (approves) the root cause report before it is sent. */
  isReportReviewer?: boolean;
}

/** Brief M20 AC4's table, R1 rows only. `clocks` is the same ComputedClocks the Issue page already derives from this issue's fields. */
export function stepsFor(issue: StepsInput, roles: StepsRoles, clocks: ComputedClocks, now: Date): IssueStep[] {
  const steps: IssueStep[] = [];

  if (roles.isOwner && issue.status === "NEW") {
    steps.push({ text: "Acknowledge", clockText: clocks.acknowledge.text, dueAt: clocks.acknowledge.dueAt, overdue: clocks.acknowledge.overdue });
  }
  if (roles.isCommunicator && issue.notifyRequired && (issue.severity === "SEV1" || issue.severity === "SEV2") && !issue.notifiedAt) {
    steps.push({ text: "Notify customer", clockText: clocks.notify.text, dueAt: clocks.notify.dueAt, overdue: clocks.notify.overdue });
  }
  if (roles.isOwner && (issue.status === "IN_PROGRESS" || issue.status === "WAITING_ON_CUSTOMER" || issue.status === "WAITING_ON_PARTNER")) {
    steps.push({ text: "Resolve", clockText: null, dueAt: null, overdue: false });
  }
  if (roles.isCommunicator && issue.status === "RESOLVED" && !issue.resolutionConfirmed) {
    steps.push({ text: "Confirm resolution with the customer", clockText: null, dueAt: null, overdue: false });
  }
  if (roles.isOwner && issue.reportTask && !issue.reportTask.sent) {
    // M20 AC14, Owner row: stays whatever the issue's status (Resolved, even Closed) until the report is recorded. Three steps, each its own person's:
    // the owner prepares the report and shares a draft; Compliance approves it; the owner sends the approved report. Waiting steps are not steps yet.
    const dueAt = issue.reportTask.dueAt;
    const overdue = dueAt !== null && dueAt.getTime() < now.getTime();
    if (!issue.reportTask.draftShared && !issue.reportTask.approved) steps.push({ text: "Prepare root cause report", clockText: null, dueAt, overdue });
    else if (issue.reportTask.approved) steps.push({ text: "Send approved report", clockText: null, dueAt, overdue });
  }
  if (roles.isReportReviewer && issue.reportTask && !issue.reportTask.sent && !issue.reportTask.approved && issue.reportTask.draftShared) {
    const dueAt = issue.reportTask.dueAt;
    steps.push({ text: "Approve root cause report", clockText: null, dueAt, overdue: dueAt !== null && dueAt.getTime() < now.getTime() });
  }
  if (
    roles.isComplianceAssessor &&
    issue.status !== "CLOSED" && // the server accepts an assessment while the issue is open or Resolved, never once closed with the customer
    issue.complianceFlaggedAt &&
    !issue.firstAssessmentAt &&
    !issue.complianceClosedAt &&
    (!issue.complianceVisibleFrom || issue.complianceVisibleFrom <= now)
  ) {
    const c = clocks.compliance;
    steps.push({ text: "Assess for Compliance", clockText: c?.text ?? null, dueAt: c?.dueAt ?? null, overdue: c?.overdue ?? false });
  }

  return steps;
}

/** "Owner", "Communicator", "Owner and communicator" or "Compliance" (M20 AC4). */
export function roleLabel(roles: StepsRoles): string {
  if (roles.isOwner && roles.isCommunicator) return "Owner and communicator";
  if (roles.isOwner) return "Owner";
  if (roles.isCommunicator) return "Communicator";
  if (roles.isComplianceAssessor || roles.isReportReviewer) return "Compliance";
  return "";
}

/** The step with the earliest due time first; steps with no deadline sort after those with one. Returns the leading step plus how many more exist. */
export function leadingStep(steps: IssueStep[]): { step: IssueStep | null; moreCount: number } {
  if (steps.length === 0) return { step: null, moreCount: 0 };
  const sorted = [...steps].sort((a, b) => {
    if (a.dueAt === null && b.dueAt === null) return 0;
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt.getTime() - b.dueAt.getTime();
  });
  return { step: sorted[0], moreCount: sorted.length - 1 };
}
