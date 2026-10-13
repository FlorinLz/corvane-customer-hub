import type { IssueStatus, Severity } from "@prisma/client";

import type { Calendar } from "@/lib/business-hours";
import { businessMinutesBetween, addBusinessMinutes } from "@/lib/business-hours";
import { dayTimeText } from "@/lib/time-block";
import { formatInZone } from "@/lib/time-zones";
import { SEVERITY_LABELS } from "@/lib/labels";
import { ACK_TARGET, NOTIFY_TARGET_SEV1_DEFAULT_HOURS, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES, COMPLIANCE_ASSESS_MINUTES } from "@/server/config";

// Brief 4.9.5. Each clock stores its start and due time when it starts
// or is recalculated; this module computes state and text on every
// read. R1 clocks only (Acknowledge, Customer notification, Compliance
// assessment countdown) -- Update/Facts/Breach are R2 (6A still creates
// their DB columns, per decision B37, but no R1 caller reads them).

export type ClockState = "queued" | "running" | "due_now" | "overdue" | "stopped_on_time" | "stopped_late" | "not_required";

/** How a stopped clock ended, for the audit line of a completed action (Who does what, "Done"). */
export interface StoppedTiming {
  /** Minutes from the clock's start to the action (business minutes where the target is a business-hours one). */
  elapsedMinutes: number;
  /** "15 min", "2 h", "1 business day": the target the clock was held to. */
  targetText: string;
  /** Minutes past the target, or null when on time. */
  lateMinutes: number | null;
}

export interface ClockResult {
  state: ClockState;
  text: string;
  dueAt: Date | null;
  overdue: boolean;
  /** Set on a stopped clock that has a start to measure from. */
  stopped?: StoppedTiming;
}

type Verb = "Acknowledge" | "Notify customer" | "Send update" | "Assess" | "Send facts pack" | "Notify data breach";

/** under 60 "25 min"; under 24h "1 h 25 min" ("2 h" when the minutes are 0); from 24h "2 days". Always a space before the unit. */
function duration(totalMinutes: number): string {
  const whole = Math.max(0, Math.round(totalMinutes));
  if (whole < 60) return `${whole} min`;
  if (whole < 24 * 60) {
    const h = Math.floor(whole / 60);
    const m = whole % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  const days = Math.floor(whole / (24 * 60));
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Brief 4.9.5 code block, verbatim. */
export function clockText(verb: Verb, due: Date, now: Date, viewerZone: string): { text: string; overdue: boolean } {
  const ms = due.getTime() - now.getTime();
  if (ms <= 0 && ms > -60_000) return { text: verb === "Send update" ? "Update due now" : `${verb} now`, overdue: false };
  if (ms <= -60_000) return { text: `Overdue by ${duration(-ms / 60_000)}`, overdue: true };
  const min = Math.ceil(ms / 60_000);
  // The Compliance card reads "Assess by 17:48 MYT (in 1 h)": the deadline, then how long is left.
  if (verb === "Assess" && min < 24 * 60) return { text: `Assess by ${dayTimeText(due, now, viewerZone)} (in ${duration(min)})`, overdue: false };
  if (min < 60) return { text: `${verb} in ${min} min`, overdue: false };
  if (min < 24 * 60) return { text: `${verb} in ${duration(min)}`, overdue: false };
  return { text: `${verb} by ${formatInZone(due, viewerZone)}`, overdue: false };
}

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return duration(minutes);
}

function businessMinutesLabel(minutes: number): string {
  if (minutes === 540) return "1 business day";
  if (minutes === 1620) return "3 business days";
  if (minutes % 60 === 0) return `${minutes / 60} business hours`;
  return `${minutes} business minutes`;
}

function runningOrOverdue(verb: Verb, due: Date, now: Date, viewerZone: string): ClockResult {
  const { text, overdue } = clockText(verb, due, now, viewerZone);
  const ms = due.getTime() - now.getTime();
  const state: ClockState = overdue ? "overdue" : ms <= 60_000 ? "due_now" : "running";
  return { state, text, dueAt: due, overdue };
}

/** "Acknowledged 9 min after Corvane became aware (target 15 min)", or "Acknowledged 3 min late" (overdue: true). */
function stoppedResult(verbPast: string, elapsedMinutes: number, sinceLabel: string, targetLabel: string, dueAt: Date, stoppedAt: Date, targetText: string): ClockResult {
  if (stoppedAt <= dueAt) {
    return {
      state: "stopped_on_time",
      text: `${verbPast} ${duration(elapsedMinutes)} after ${sinceLabel} (target ${targetLabel})`,
      dueAt,
      overdue: false,
      stopped: { elapsedMinutes, targetText, lateMinutes: null },
    };
  }
  const lateMinutes = (stoppedAt.getTime() - dueAt.getTime()) / 60_000;
  return { state: "stopped_late", text: `${verbPast} ${duration(lateMinutes)} late`, dueAt, overdue: true, stopped: { elapsedMinutes, targetText, lateMinutes } };
}

/** "15 min", "2 h", "1 day": the target as the audit line writes it (same spans as the time block). */
function targetSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const days = Math.floor(minutes / (24 * 60));
  return `${days} day${days === 1 ? "" : "s"}`;
}

export interface IssueClockFields {
  severity: Severity;
  status: IssueStatus;
  severityCapLabel: string | null;
  clocksStartAt: Date;
  ackStartAt: Date | null;
  acknowledgedAt: Date | null;
  notifyRequired: boolean;
  notifyStartAt: Date | null;
  notifyTargetHours: number | null;
  notifyDefaultTarget: boolean;
  notifyTargetBusinessMins: number | null;
  notifiedAt: Date | null;
  complianceFlaggedAt: Date | null;
  complianceClockStartAt: Date | null;
  /** The earliest ComplianceAssessment.assessedAt on this issue, or null when none exists yet. */
  firstAssessmentAt: Date | null;
}

export interface ClocksContext {
  ownerCalendar: Calendar | null; // null only while queued with no named person (rule 4)
  communicatorCalendar: Calendar | null;
  viewerZone: string;
}

export interface ComputedClocks {
  acknowledge: ClockResult;
  notify: ClockResult;
  compliance: ClockResult | null; // null when never flagged
}

function ackClock(issue: IssueClockFields, ctx: ClocksContext, now: Date): ClockResult {
  const target = ACK_TARGET[issue.severity];
  const start = issue.ackStartAt ?? issue.clocksStartAt;
  if (now < issue.clocksStartAt) {
    return { state: "queued", text: `Clocks start ${formatInZone(issue.clocksStartAt, ctx.viewerZone)}, the start of business hours`, dueAt: null, overdue: false };
  }
  const due = target.business && ctx.ownerCalendar ? addBusinessMinutes(start, target.minutes, ctx.ownerCalendar) : new Date(start.getTime() + target.minutes * 60_000);
  const targetLabel = target.business ? businessMinutesLabel(target.minutes) : minutesLabel(target.minutes);

  if (issue.acknowledgedAt) {
    const elapsed = target.business && ctx.ownerCalendar
      ? businessMinutesBetween(start, issue.acknowledgedAt, ctx.ownerCalendar)
      : (issue.acknowledgedAt.getTime() - start.getTime()) / 60_000;
    return stoppedResult("Acknowledged", elapsed, "Corvane became aware", targetLabel, due, issue.acknowledgedAt, target.business ? businessMinutesLabel(target.minutes) : targetSpan(target.minutes));
  }
  return runningOrOverdue("Acknowledge", due, now, ctx.viewerZone);
}

function notifyClock(issue: IssueClockFields, ctx: ClocksContext, now: Date): ClockResult {
  if (!issue.notifyRequired) {
    const preGoLive = issue.severityCapLabel?.includes("before go-live") ?? false;
    const text = preGoLive ? "Customer notification: not required before go-live" : `Customer notification: no deadline at ${SEVERITY_LABELS[issue.severity]}`;
    return { state: "not_required", text, dueAt: null, overdue: false };
  }

  const start = issue.notifyStartAt ?? issue.clocksStartAt;
  if (now < issue.clocksStartAt) {
    return { state: "queued", text: `Clocks start ${formatInZone(issue.clocksStartAt, ctx.viewerZone)}, the start of business hours`, dueAt: null, overdue: false };
  }

  const isSev1 = issue.severity === "SEV1";
  const targetMinutes = isSev1 ? (issue.notifyTargetHours ?? NOTIFY_TARGET_SEV1_DEFAULT_HOURS) * 60 : (issue.notifyTargetBusinessMins ?? NOTIFY_TARGET_SEV2_BUSINESS_MINUTES);
  const targetLabel = isSev1 ? minutesLabel(targetMinutes) : businessMinutesLabel(targetMinutes);
  const due = isSev1 || !ctx.communicatorCalendar
    ? new Date(start.getTime() + targetMinutes * 60_000)
    : addBusinessMinutes(start, targetMinutes, ctx.communicatorCalendar);

  if (issue.notifiedAt) {
    if (issue.notifiedAt < start) {
      return { state: "stopped_on_time", text: "Notified before the clock started", dueAt: due, overdue: false };
    }
    const elapsed = isSev1 || !ctx.communicatorCalendar
      ? (issue.notifiedAt.getTime() - start.getTime()) / 60_000
      : businessMinutesBetween(start, issue.notifiedAt, ctx.communicatorCalendar);
    return stoppedResult("Notified", elapsed, "Corvane became aware", targetLabel, due, issue.notifiedAt, isSev1 ? targetSpan(targetMinutes) : businessMinutesLabel(targetMinutes));
  }
  return runningOrOverdue("Notify customer", due, now, ctx.viewerZone);
}

function complianceClock(issue: IssueClockFields, ctx: ClocksContext, now: Date): ClockResult | null {
  if (!issue.complianceFlaggedAt) return null;
  if (issue.firstAssessmentAt) {
    const start = issue.complianceClockStartAt ?? issue.complianceFlaggedAt;
    const due = new Date(start.getTime() + COMPLIANCE_ASSESS_MINUTES * 60_000);
    const elapsed = (issue.firstAssessmentAt.getTime() - start.getTime()) / 60_000;
    return stoppedResult("Assessed", elapsed, "the flag", minutesLabel(COMPLIANCE_ASSESS_MINUTES), due, issue.firstAssessmentAt, targetSpan(COMPLIANCE_ASSESS_MINUTES));
  }
  if (!issue.complianceClockStartAt || issue.severity !== "SEV1") {
    return { state: "not_required", text: "Assessment pending", dueAt: null, overdue: false };
  }
  const due = new Date(issue.complianceClockStartAt.getTime() + COMPLIANCE_ASSESS_MINUTES * 60_000);
  return runningOrOverdue("Assess", due, now, ctx.viewerZone);
}

export function computeClocks(issue: IssueClockFields, ctx: ClocksContext, now: Date): ComputedClocks {
  return {
    acknowledge: ackClock(issue, ctx, now),
    notify: notifyClock(issue, ctx, now),
    compliance: complianceClock(issue, ctx, now),
  };
}

/**
 * The Issue page's own top deadline banner: whichever running clock is
 * due soonest. Exported (not page-local) so the banner can be recomputed
 * live, client-side, on the same tick as IssueClocksPanel's own clocks --
 * computed once, server-side, at page render instead, it fell behind the
 * clocks below it the longer the page stayed open, showing a different,
 * stale "Overdue by" value for the same clock.
 */
export function nextDeadline(clocks: ComputedClocks, options?: { excludeAcknowledge?: boolean }): ClockResult | null {
  // excludeAcknowledge: a CREATED linked issue (brief M23) needs no
  // acknowledgement of its own -- its "acknowledge" clock is a dummy
  // computeClocks() can't tell isn't real (see IssueClocksPanel's own
  // `linkedParent` prop), so it must never surface here either.
  const candidates = [options?.excludeAcknowledge ? null : clocks.acknowledge, clocks.notify, clocks.compliance].filter(
    (c): c is ClockResult => !!c && c.dueAt !== null && (c.state === "running" || c.state === "due_now" || c.state === "overdue"),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((earliest, c) => (c.dueAt! < earliest.dueAt! ? c : earliest));
}

/**
 * A partner issue's acknowledge deadline, which its linked issues mirror: counted from where its acknowledge clock starts, by its own severity
 * target (business minutes of its owner's calendar for Sev-3 and Sev-4). The stored `ackDueAt` is only written for seeded issues; new ones derive it.
 */
export function ackDueAtOf(p: { severity: IssueClockFields["severity"]; ackStartAt: Date | null; clocksStartAt: Date; ownerCalendar: Calendar | null }): Date {
  const target = ACK_TARGET[p.severity];
  const start = p.ackStartAt ?? p.clocksStartAt;
  return target.business && p.ownerCalendar ? addBusinessMinutes(start, target.minutes, p.ownerCalendar) : new Date(start.getTime() + target.minutes * 60_000);
}
