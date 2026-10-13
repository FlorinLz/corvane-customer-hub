import type { IssueImpact, IssueStatus, IssueType, Scheme, Severity } from "@prisma/client";

import { formatInZone } from "@/lib/time-zones";
import { ISSUE_IMPACT_LABELS, ISSUE_TYPE_LABELS, SCHEME_LABELS, SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { GMAIL_COMPOSE_URL, UPDATE_INTERVAL_MINUTES } from "@/server/config";

// Brief 4.9.10, M22 AC3-AC5. Pure: the caller resolves the incident
// contact (the existing Partner/Customer-context primary Incident
// contact pattern, M7 AC9) and passes it in, so the Issue page's data
// loader fetches that contact once for both this message and the
// header's incident-contact block.

/**
 * Judgment call (see DECISIONS.md): no country-timezone library is
 * installed. Scoped to the countries the seed actually uses, mirroring
 * business-hours.ts's TEAM_TIME_ZONES precedent of a small static map
 * rather than a general library -- this only affects the greeting's
 * displayed times when an entity has no active incident contact
 * (M22 edge case 1), never a clock or a deadline.
 */
const COUNTRY_TIME_ZONES: Record<string, string> = {
  AT: "Europe/Vienna",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  FI: "Europe/Helsinki",
  FR: "Europe/Paris",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  IT: "Europe/Rome",
  NL: "Europe/Amsterdam",
  PT: "Europe/Lisbon",
  SG: "Asia/Singapore",
};

/**
 * The status as the customer reads it, never the internal status name: New, Acknowledged and Investigating (in progress, waiting on the customer or the
 * partner) read "Investigating"; Mitigated and Monitoring, if they ever exist, read "Fix applied, monitoring"; anything else reads "Investigating".
 */
export function customerFacingStatus(status: string): string {
  switch (status) {
    case "MITIGATED":
    case "MONITORING":
      return "Fix applied, monitoring";
    default:
      return "Investigating"; // NEW, ACKNOWLEDGED, IN_PROGRESS, WAITING_ON_*, and anything else
  }
}

export interface MessageContact {
  name: string;
  email: string;
  timeZone: string;
}

export interface MessageIssue {
  number: number;
  type: IssueType;
  scheme: Scheme | null;
  country: string | null;
  impact: IssueImpact;
  status: IssueStatus;
  severity: Severity;
  awareAt: Date;
}

export interface MessageEntity {
  legalName: string;
  country: string | null;
}

export interface BuiltMessage {
  subject: string;
  body: string;
  to: string | null;
  toName: string | null;
}

/** Fallback zone for the greeting's times when there is no active incident contact. */
function fallbackZone(issue: MessageIssue, entity: MessageEntity): string {
  return (issue.country && COUNTRY_TIME_ZONES[issue.country]) || (entity.country && COUNTRY_TIME_ZONES[entity.country]) || "Europe/Bucharest";
}

function roundUpToNext5Minutes(d: Date): Date {
  const fiveMin = 5 * 60_000;
  return new Date(Math.ceil(d.getTime() / fiveMin) * fiveMin);
}

/**
 * `preparedAt`: the instant the preview is built (brief's "prepared by
 * <communicator> at <time>"), used only for "Next update by" -- not
 * `now()` at the moment a notification is later recorded.
 */
export function buildMessage(issue: MessageIssue, entity: MessageEntity, contact: MessageContact | null, communicatorName: string, preparedAt: Date): BuiltMessage {
  const displayId = issueDisplayId(issue.number);
  const zone = contact?.timeZone ?? fallbackZone(issue, entity);

  const schemeCountry = issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]} ${issue.country}` : "";
  const subject = `[Corvane] ${SEVERITY_LABELS[issue.severity]} incident ${displayId}${schemeCountry ? `: ${schemeCountry}` : ""}`;

  const greeting = contact ? `Dear ${contact.name},` : `Dear ${entity.legalName} team,`;
  const affectedService = issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]}, ${issue.country}` : ISSUE_TYPE_LABELS[issue.type];

  const intervalMinutes = UPDATE_INTERVAL_MINUTES[issue.severity];
  const nextUpdateLine = intervalMinutes
    ? `Next update by: ${formatInZone(roundUpToNext5Minutes(new Date(preparedAt.getTime() + intervalMinutes * 60_000)), zone)}`
    : "Next update: when the status changes";

  // M22 AC3's own worked example ends "... Siena S.p.A." with a single period, even though the
  // template text literally appends one: never double up when the legal name already ends in one.
  const affectingLine = `We are informing you of an incident affecting ${entity.legalName}${entity.legalName.endsWith(".") ? "" : "."}`;

  const body = [
    greeting,
    "",
    affectingLine,
    "",
    `Affected service: ${affectedService}`,
    `Corvane aware at: ${formatInZone(issue.awareAt, zone)}`,
    `Impact: ${ISSUE_IMPACT_LABELS[issue.impact]}`,
    `Current status: ${customerFacingStatus(issue.status)}`,
    nextUpdateLine,
    `Issue ID: ${displayId}`,
    "",
    `Please quote ${displayId} in any reply.`,
    "",
    "Kind regards,",
    communicatorName,
    "Corvane",
  ].join("\n");

  return { subject, body, to: contact?.email ?? null, toName: contact?.name ?? null };
}

/** Brief 4.9.10. The client opens this with `window.open(url, "_blank")`. */
export function gmailComposeUrl(to: string | null, subject: string, body: string): string {
  const q = encodeURIComponent;
  return `${GMAIL_COMPOSE_URL}&to=${q(to ?? "")}&su=${q(subject)}&body=${q(body)}`;
}
