import type { IssueImpact, IssueStatus } from "@prisma/client";

import { formatInZone } from "@/lib/time-zones";
import { ISSUE_TYPE_LABELS, SCHEME_LABELS, SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { UPDATE_INTERVAL_MINUTES } from "@/server/config";
import { buildMessage, customerFacingStatus, type BuiltMessage, type MessageContact, type MessageEntity, type MessageIssue } from "@/server/issues/message";

// Stage-aware message to the customer (or to the partner on a partner issue). Four templates, picked from the issue's state; the app sends
// nothing itself: the person copies or opens Gmail, sends it, then records it. Pure: the page loader passes everything in.

export type MessageStage = "FIRST_NOTIFICATION" | "UPDATE" | "RESOLUTION" | "REPORT";

export const MESSAGE_STAGE_LABELS: Record<MessageStage, string> = {
  FIRST_NOTIFICATION: "First notification",
  UPDATE: "Update",
  RESOLUTION: "Resolution",
  REPORT: "Root cause report",
};

/** The line the person completes in an Update. While it is unchanged the page says "Complete 'What we are doing' before sending." */
export const UPDATE_PLACEHOLDER_LINE = "What we are doing: [one line to complete before sending]";
export const UPDATE_HINT = "Complete 'What we are doing' before sending.";

export { customerFacingStatus };

export interface StageInput {
  status: IssueStatus;
  /** A first notification is already recorded. */
  notified: boolean;
  isPartnerIssue: boolean;
  /** The root cause report is approved by Compliance and not yet sent. */
  reportReadyToSend: boolean;
  /** The viewer owns the issue: the report message is the owner's. */
  viewerIsOwner: boolean;
}

/** Which template the panel shows: the report to the owner once it is approved; the resolution once Resolved; an update once a notification went out; else the first notification. */
export function selectStage(s: StageInput): MessageStage {
  if (!s.isPartnerIssue && s.reportReadyToSend && s.viewerIsOwner) return "REPORT";
  if (s.status === "RESOLVED" || s.status === "CLOSED") return "RESOLUTION";
  if (s.notified) return "UPDATE";
  return "FIRST_NOTIFICATION";
}

export interface StageMessageInput {
  issue: MessageIssue & { resolvedAt: Date | null };
  entity: MessageEntity;
  contact: MessageContact | null;
  /** The communicator signs messages 1 to 3 and the owner signs the report. */
  communicatorName: string;
  ownerName: string;
  isPartnerIssue: boolean;
  resolution: { rootCause: string; solution: string } | null;
  /** The root cause report task, when there is one: its deadline, and the approved draft. */
  report: { dueAt: Date | null; draftSummary: string | null; draftLink: string | null } | null;
  preparedAt: Date;
}

const COUNTRY_ZONE_FALLBACK = "Europe/Bucharest";

/** "Mon 05 Oct" in the zone (the year only when it is not the current one). */
function dateIn(at: Date, zone: string): string {
  return formatInZone(at, zone).replace(/,\s.*$/, "");
}

/** The report summary as separate lines: "Cause: ...", "Impact: ..." and "Fix: ..." each start a line, like the Resolution template's Cause and Solution. */
function reportSummaryLines(summary: string): string {
  return summary.trim().replace(/\s*\b(Cause|Impact|Fix):/g, "\n$1:").replace(/^\n/, "");
}

const PARTNER_IMPACT: Record<IssueImpact, string> = {
  DOWN: "an outage",
  DEGRADED: "degraded performance",
  ISOLATED_CASE: "isolated failures",
  QUESTION_OR_REQUEST: "an issue",
};

function roundUpToNext5Minutes(d: Date): Date {
  return new Date(Math.ceil(d.getTime() / 300_000) * 300_000);
}

export function buildStageMessage(stage: MessageStage, input: StageMessageInput): BuiltMessage {
  const { issue, entity, contact, communicatorName, ownerName, isPartnerIssue, resolution, report, preparedAt } = input;
  const displayId = issueDisplayId(issue.number);
  const zone = contact?.timeZone ?? COUNTRY_ZONE_FALLBACK;
  const schemeCountry = issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]} ${issue.country}` : "";
  const service = issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]}, ${issue.country}` : ISSUE_TYPE_LABELS[issue.type];
  const sev = SEVERITY_LABELS[issue.severity];
  const greeting = contact ? `Dear ${contact.name},` : `Dear ${entity.legalName} team,`;
  const quote = `Please quote ${displayId} in any reply.`;
  const interval = UPDATE_INTERVAL_MINUTES[issue.severity];
  const nextUpdate = interval ? `Next update by: ${formatInZone(roundUpToNext5Minutes(new Date(preparedAt.getTime() + interval * 60_000)), zone)}` : "Next update: when the status changes";
  const subjectTail = `${sev} incident ${displayId}${schemeCountry ? `: ${schemeCountry}` : ""}`;
  const to = contact?.email ?? null;
  const toName = contact?.name ?? null;
  const aware = formatInZone(issue.awareAt, zone);
  const resolved = issue.resolvedAt ? formatInZone(issue.resolvedAt, zone) : formatInZone(preparedAt, zone);
  const lines = (...parts: (string | null)[]) => parts.filter((p): p is string => p !== null).join("\n");

  if (stage === "FIRST_NOTIFICATION") {
    if (!isPartnerIssue) return buildMessage(issue, entity, contact, communicatorName, preparedAt);
    return {
      subject: `[Corvane] ${subjectTail}`,
      body: lines(
        greeting, "",
        `We are seeing ${PARTNER_IMPACT[issue.impact]} on your ${issue.scheme ? SCHEME_LABELS[issue.scheme] : "service"} service${issue.country ? ` (${issue.country})` : ""} since ${aware}. Our teams are investigating and will keep you updated.`, "",
        `Current status: ${customerFacingStatus(issue.status)}`, nextUpdate, `Issue ID: ${displayId}`, "",
        quote, "", "Kind regards,", communicatorName, "Corvane",
      ),
      to,
      toName,
    };
  }

  if (stage === "UPDATE") {
    return {
      subject: `[Corvane] Update: ${subjectTail}`,
      body: lines(
        greeting, "",
        isPartnerIssue ? `This is an update on incident ${displayId} on your ${issue.scheme ? SCHEME_LABELS[issue.scheme] : "service"} service${issue.country ? ` (${issue.country})` : ""}.` : `This is an update on incident ${displayId} affecting ${entity.legalName}.`, "",
        `Current status: ${customerFacingStatus(issue.status)}`, UPDATE_PLACEHOLDER_LINE, nextUpdate, "",
        quote, "", "Kind regards,", communicatorName, "Corvane",
      ),
      to,
      toName,
    };
  }

  if (stage === "RESOLUTION") {
    const reportLine = !isPartnerIssue && report ? (report.dueAt ? `A root cause report will follow by ${dateIn(report.dueAt, zone)}, as agreed in our contract.` : "A root cause report will follow, as agreed in our contract.") : null;
    return {
      subject: `[Corvane] Resolved: ${subjectTail}`,
      body: lines(
        greeting, "",
        isPartnerIssue ? `Thank you for restoring ${issue.scheme ? SCHEME_LABELS[issue.scheme] : "the service"}${issue.country ? ` (${issue.country})` : ""}. The incident is resolved on our side as well.` : `The incident affecting ${entity.legalName} has been resolved.`, "",
        `Affected service: ${service}`, `Corvane aware at: ${aware}`, `Resolved at: ${resolved}`,
        `Cause: ${resolution?.rootCause ?? "—"}`, `Solution: ${resolution?.solution ?? "—"}`, "",
        "Please reply to confirm that the service works as expected on your side.",
        reportLine, "",
        quote, "", "Kind regards,", communicatorName, "Corvane",
      ),
      to,
      toName,
    };
  }

  // REPORT: the approved draft, from the owner. Never on a partner issue.
  return {
    subject: `[Corvane] Root cause report: incident ${displayId}`,
    body: lines(
      greeting, "",
      `Please find the root cause report for incident ${displayId}, which affected ${entity.legalName} on ${dateIn(issue.awareAt, zone)}.`, "",
      report?.draftSummary ? reportSummaryLines(report.draftSummary) : "", "",
      `Report: ${report?.draftLink ?? "—"}`, "",
      quote, "", "Kind regards,", ownerName, "Corvane",
    ),
    to,
    toName,
  };
}
