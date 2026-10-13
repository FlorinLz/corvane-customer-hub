import type { Calendar } from "@/lib/business-hours";
import { addBusinessMinutes } from "@/lib/business-hours";
import { ACK_TARGET, NOTIFY_TARGET_SEV1_DEFAULT_HOURS, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES } from "@/server/config";
import type { Severity } from "@prisma/client";

// Three timestamps: Event <= Corvane aware at <= Opened <= now (demo clock).
// Pure rules shared by the report, the correction and the Resolve dialog. Messages are the ones the notes give.

export const TIMES_MESSAGES = {
  awareBeforeEvent: "Corvane aware at can't be before the event",
  awareInFuture: "Corvane aware at can't be in the future",
  eventAfterAware: "Event can't be after Corvane aware at",
  awareAfterOpened: "Corvane aware at can't be after the issue was opened",
  eventInvalid: "Enter a valid event date and time",
  awareInvalid: "Enter a valid Corvane aware at date and time",
} as const;

export interface TimesCheck {
  /** Event; null means Unknown, which is always allowed here. */
  eventAt: Date | null;
  awareAt: Date;
  /** The issue's creation time. Omit when reporting: Opened is then "now". */
  openedAt?: Date;
  now: Date;
}

export type TimesErrors = Partial<Record<"eventAt" | "awareAt", string>>;

/** Order check. Returns field errors, or an empty object when the three times are in order. */
export function checkTimes({ eventAt, awareAt, openedAt, now }: TimesCheck): TimesErrors {
  const errors: TimesErrors = {};
  if (Number.isNaN(awareAt.getTime())) errors.awareAt = TIMES_MESSAGES.awareInvalid;
  if (eventAt && Number.isNaN(eventAt.getTime())) errors.eventAt = TIMES_MESSAGES.eventInvalid;
  if (errors.awareAt || errors.eventAt) return errors;

  if (awareAt > now) errors.awareAt = TIMES_MESSAGES.awareInFuture;
  else if (openedAt && awareAt > openedAt) errors.awareAt = TIMES_MESSAGES.awareAfterOpened;
  if (eventAt && eventAt > awareAt) {
    errors.eventAt = TIMES_MESSAGES.eventAfterAware;
    errors.awareAt ??= TIMES_MESSAGES.awareBeforeEvent;
  }
  return errors;
}

/**
 * Where the acknowledge clock starts. Every deadline counts from Corvane aware at. An issue whose owner team is out of
 * hours (clocks deferred to the next business start) counts from that start instead, so the queued
 * "Clocks start ..." state stays.
 */
export function ackStartFor(awareAt: Date, clocksStartAt: Date, savedAt: Date): Date {
  return clocksStartAt.getTime() > savedAt.getTime() ? clocksStartAt : awareAt;
}

/** A Sev-1 whose Event is still Unknown must have it entered before it can be resolved (root cause report). */
export function resolveNeedsEvent(issue: { severity: string; eventAt: Date | null }): boolean {
  return issue.severity === "SEV1" && issue.eventAt === null;
}

// ───────────── Correct times: deadline recalculation (rule 5) ─────────────

export interface ClockSnapshot {
  severity: Severity;
  status: string;
  createdAt: Date;
  clocksStartAt: Date;
  acknowledgedAt: Date | null;
  ackStartAt: Date | null;
  notifyRequired: boolean;
  notifiedAt: Date | null;
  notifyStartAt: Date | null;
  notifyTargetHours: number | null;
  notifyTargetBusinessMins: number | null;
}

export interface ClockPatch {
  ackStartAt?: Date;
  ackDueAt?: Date;
  notifyStartAt?: Date;
  notifyDueAt?: Date;
}

/**
 * Open deadlines count from the corrected Corvane aware at. A deadline already met (acknowledged, notified) keeps its start,
 * so it stays met with its recorded result; the clocks of a resolved or closed issue do not change at all.
 * `ownerCalendar` times the acknowledge target, `communicatorCalendar` the Sev-2 notification target.
 */
export function recalculateClocks(issue: ClockSnapshot, newAwareAt: Date, ownerCalendar: Calendar, communicatorCalendar: Calendar): ClockPatch {
  const patch: ClockPatch = {};
  if (issue.status === "RESOLVED" || issue.status === "CLOSED") return patch;

  if (!issue.acknowledgedAt && issue.ackStartAt) {
    const start = ackStartFor(newAwareAt, issue.clocksStartAt, issue.createdAt);
    const target = ACK_TARGET[issue.severity];
    patch.ackStartAt = start;
    patch.ackDueAt = target.business ? addBusinessMinutes(start, target.minutes, ownerCalendar) : new Date(start.getTime() + target.minutes * 60_000);
  }

  if (issue.notifyRequired && !issue.notifiedAt) {
    patch.notifyStartAt = newAwareAt;
    if (issue.severity === "SEV1") {
      const hours = issue.notifyTargetHours ?? NOTIFY_TARGET_SEV1_DEFAULT_HOURS;
      patch.notifyDueAt = new Date(newAwareAt.getTime() + hours * 3_600_000);
    } else {
      patch.notifyDueAt = addBusinessMinutes(newAwareAt, issue.notifyTargetBusinessMins ?? NOTIFY_TARGET_SEV2_BUSINESS_MINUTES, communicatorCalendar);
    }
  }
  return patch;
}
