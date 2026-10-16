import type { AssessmentOutcome, CommunicationType, IssueStatus, IssueType, RegulatoryRegime, Severity } from "@prisma/client";

import { addBusinessMinutes, businessMinutesBetween, type Calendar } from "@/lib/business-hours";
import {
  CONFIRM_TARGET,
  FACTS_FOR_REGULATOR,
  PARTNER_CHASE_TARGET,
  REPLY_ISSUE_TYPES,
  RESTORE_ISSUE_TYPES,
  REPLY_TARGET,
  RESOLVE_TARGET,
  RESTORE_TARGET,
  SOON_MINUTES,
  SOON_SHARE,
  UPDATE_CADENCE,
  type Target,
} from "@/server/config";

// The deadline model (DECISIONS.md "Deadline model"): the clocks that come after Acknowledge, Notify customer and Assess, which issue-clocks.ts
// keeps. Pure: start, due, stop, repeat and pause, from the facts of an issue. role-actions.ts turns the result into steps.

export type DeadlineKey = "restore" | "resolve" | "update" | "facts" | "confirm" | "chase" | "reply";
export type DeadlineRole = "Owner" | "Communicator" | "Compliance";

export interface Deadline {
  key: DeadlineKey;
  role: DeadlineRole;
  /** open: running. paused: Waiting on customer holds it. done: stopped by the action it asks for. */
  state: "open" | "paused" | "done";
  /** The due time. While paused it is the due time if the pause ended now. Null for a done clock. */
  dueAt: Date | null;
  startAt: Date;
  /** The target, in minutes of the clock's own kind (wall minutes, or business minutes). */
  targetMinutes: number;
  business: boolean;
  /** Minutes left in the clock's own kind at `now` (frozen while paused), null when done. */
  remainingMinutes: number | null;
  /** Share of the target left, 0 to 1 (can be negative once overdue), null when done. */
  share: number | null;
  /** The instant the clock turns orange: 60 minutes before it is due, or when 25% of the target is left, whichever comes first. Null when done or paused. */
  soonAt: Date | null;
  repeating: boolean;
  /** done only: when the action happened. */
  doneAt?: Date;
  /** done only: how long it took (in the clock's own kind of minutes) and how late it was, null when on time. */
  stopped?: { elapsedMinutes: number; lateMinutes: number | null };
  /** paused only: since when, and why. */
  pausedSince?: Date;
  pausedFor?: string;
}

export interface DeadlineFacts {
  severity: Severity;
  status: IssueStatus;
  type: IssueType;
  /** The partner's own issue (communicatorRule ISSUE_OWNER_PARTNER). */
  isPartnerIssue: boolean;
  /** A linked issue created from a partner issue: it resolves with its parent, so it has no Restore, Resolve or Chase of its own. */
  isLinkedChild: boolean;
  awareAt: Date;
  notifyRequired: boolean;
  notifiedAt: Date | null;
  /** The latest UPDATE communication, or null. */
  lastUpdateAt: Date | null;
  restoredAt: Date | null;
  resolvedAt: Date | null;
  closureConfirmedAt: Date | null;
  /** The first reply to the customer (first notification or update), for BILLING and COMMERCIAL_COVERAGE. */
  repliedAt: Date | null;
  waitingOnCustomerSince: Date | null;
  pausedMinutes: number;
  pausedBusinessMinutes: number;
  /** Hours the customer's regulator needs facts within (the Customer obligations card), only when Compliance assessed a possible major incident at a regulated customer. */
  factsHours: number | null;
  /** When Compliance assessed it (the facts clock starts here). */
  factsStartAt: Date | null;
  factsSentAt: Date | null;
  /** The latest communication to the partner on a partner issue. */
  lastPartnerContactAt: Date | null;
}

export interface DeadlineCalendars {
  owner: Calendar | null;
  communicator: Calendar | null;
}

const MS = 60_000;

/** `start` plus `target`, in the owner's business minutes or in wall minutes; `extra` is time to add on top (paused time). */
export function addTarget(start: Date, target: Target, cal: Calendar | null, extra: { wall: number; business: number } = { wall: 0, business: 0 }): Date {
  if (target.business && cal) return addBusinessMinutes(start, target.minutes + extra.business, cal);
  return new Date(start.getTime() + (target.minutes + extra.wall) * MS);
}

function remaining(due: Date, now: Date, target: Target, cal: Calendar | null): number {
  if (target.business && cal) return due >= now ? businessMinutesBetween(now, due, cal) : -businessMinutesBetween(due, now, cal);
  return (due.getTime() - now.getTime()) / MS;
}

interface Pause {
  wall: number;
  business: number;
  since: Date | null;
}

function pauseOf(f: DeadlineFacts): Pause {
  const since = f.status === "WAITING_ON_CUSTOMER" ? f.waitingOnCustomerSince : null;
  return { wall: f.pausedMinutes, business: f.pausedBusinessMinutes, since };
}

/** Due time of a clock that Waiting on customer pauses: the pause so far (closed and open) pushes it out. */
function dueWithPause(start: Date, target: Target, cal: Calendar | null, pause: Pause, now: Date): Date {
  const openWall = pause.since ? Math.max(0, (now.getTime() - pause.since.getTime()) / MS) : 0;
  const openBusiness = pause.since && cal ? businessMinutesBetween(pause.since, now, cal) : 0;
  return addTarget(start, target, cal, { wall: pause.wall + openWall, business: pause.business + openBusiness });
}

const shareCache = new Map<string, number>();

/**
 * When 25% of the target is left. Business clocks: the instant the owner's business minutes left drop to a quarter of the target, found by bisection to
 * the minute inside a window that must hold it (business time is at least about a third of wall time, less two days off). The date maths is the
 * slow part of a Home load, so the answer is remembered: the same due time and calendar give the same instant.
 */
function shareInstant(due: Date, target: Target, cal: Calendar | null): Date {
  const quarter = target.minutes * SOON_SHARE;
  if (!(target.business && cal)) return new Date(due.getTime() - quarter * MS);
  const key = `${cal.timeZone}|${cal.start}|${cal.end}|${cal.weekdays.join("")}|${due.getTime()}|${target.minutes}`;
  const hit = shareCache.get(key);
  if (hit !== undefined) return new Date(hit);
  let lo = due.getTime() - (quarter * 4 + 3 * 24 * 60) * MS; // more than a quarter is left from here
  let hi = due.getTime();
  while (hi - lo > MS) {
    const mid = Math.floor((lo + hi) / 2);
    if (businessMinutesBetween(new Date(mid), due, cal) > quarter) lo = mid;
    else hi = mid;
  }
  if (shareCache.size > 5000) shareCache.clear();
  shareCache.set(key, hi);
  return new Date(hi);
}

function soonInstant(due: Date, target: Target, cal: Calendar | null): Date {
  const byMinutes = due.getTime() - SOON_MINUTES * MS;
  return new Date(Math.min(byMinutes, shareInstant(due, target, cal).getTime()));
}

function build(
  key: DeadlineKey,
  role: DeadlineRole,
  start: Date,
  target: Target,
  cal: Calendar | null,
  now: Date,
  opts: { pause?: Pause; repeating?: boolean; due?: Date } = {},
): Deadline {
  const due = opts.due ?? (opts.pause ? dueWithPause(start, target, cal, opts.pause, now) : addTarget(start, target, cal));
  const left = remaining(due, now, target, cal);
  const paused = !!opts.pause?.since;
  return {
    key,
    role,
    state: paused ? "paused" : "open",
    dueAt: due,
    startAt: start,
    targetMinutes: target.minutes,
    business: target.business && !!cal,
    remainingMinutes: left,
    share: target.minutes > 0 ? left / target.minutes : null,
    soonAt: paused ? null : soonInstant(due, target, cal),
    repeating: !!opts.repeating,
    ...(paused ? { pausedSince: opts.pause!.since!, pausedFor: "Waiting on customer" } : {}),
  };
}

function done(key: DeadlineKey, role: DeadlineRole, start: Date, target: Target, cal: Calendar | null, at: Date): Deadline {
  const business = target.business && !!cal;
  const due = addTarget(start, target, cal);
  const elapsed = business ? businessMinutesBetween(start, at, cal!) : (at.getTime() - start.getTime()) / MS;
  const late = at > due ? (business ? businessMinutesBetween(due, at, cal!) : (at.getTime() - due.getTime()) / MS) : null;
  return { key, role, state: "done", dueAt: null, startAt: start, targetMinutes: target.minutes, business, remainingMinutes: null, share: null, soonAt: null, repeating: false, doneAt: at, stopped: { elapsedMinutes: elapsed, lateMinutes: late } };
}

const finished = (s: IssueStatus) => s === "RESOLVED" || s === "CLOSED";

/**
 * The deadlines of an issue after Acknowledge, Notify customer and Assess, at `now`. See config.ts for each target and its source.
 *  - Restore (owner): stops when the owner records "Service restored", or at Resolve (resolving restores). Paused by Waiting on customer.
 *  - Resolve (owner): stops at Resolve. Paused by Waiting on customer.
 *  - Update (communicator, repeating): restarts at every UPDATE (or the first notification), stops at resolution. Every 60 min until restored, then 4 h (Sev-1).
 *  - Facts for the regulator (communicator): from the assessment, stops when the facts pack is recorded. Once.
 *  - Confirm resolution (communicator): from the resolution, stops when the closure is confirmed.
 *  - Partner chase (owner, repeating, partner issues): restarts at every contact with the partner. WAITING_ON_PARTNER pauses nothing.
 *  - Reply to customer (owner, BILLING and COMMERCIAL_COVERAGE): stops at the first reply. Paused by Waiting on customer.
 */
export function computeDeadlines(f: DeadlineFacts, cals: DeadlineCalendars, now: Date): Deadline[] {
  const out: Deadline[] = [];
  const pause = pauseOf(f);
  const isReplyType = REPLY_ISSUE_TYPES.includes(f.type);
  // Back to work (Resolved to In progress) leaves resolvedAt in place: only the status says the issue is resolved now.
  const resolved = finished(f.status);
  const resolvedAt = resolved ? f.resolvedAt : null;

  if (!f.isLinkedChild && RESTORE_ISSUE_TYPES.includes(f.type)) {
    const restore = RESTORE_TARGET[f.severity];
    if (restore) {
      const restoredAt = f.restoredAt ?? resolvedAt;
      out.push(restoredAt ? done("restore", "Owner", f.awareAt, restore, cals.owner, restoredAt) : build("restore", "Owner", f.awareAt, restore, cals.owner, now, { pause }));
    }
  }

  if (!f.isLinkedChild) {
    const resolve = RESOLVE_TARGET[f.severity];
    if (resolve) {
      out.push(resolvedAt ? done("resolve", "Owner", f.awareAt, resolve, cals.owner, resolvedAt) : build("resolve", "Owner", f.awareAt, resolve, cals.owner, now, { pause }));
    }
  }

  // Customer updates: customer issues only (a partner issue is chased, not updated), once the customer has been notified, until resolved.
  const cadence = UPDATE_CADENCE[f.severity];
  if (cadence && !f.isPartnerIssue && !isReplyType && f.notifyRequired && f.notifiedAt && !resolved) {
    const restored = !!f.restoredAt;
    const target = restored ? cadence.afterRestore : cadence.beforeRestore;
    const start = f.lastUpdateAt && f.lastUpdateAt > f.notifiedAt ? f.lastUpdateAt : f.notifiedAt;
    out.push(build("update", "Communicator", start, target, cals.communicator, now, { repeating: true }));
  }

  if (f.factsHours !== null && f.factsStartAt) {
    const target: Target = { minutes: f.factsHours * 60, business: false };
    out.push(f.factsSentAt ? done("facts", "Communicator", f.factsStartAt, target, null, f.factsSentAt) : build("facts", "Communicator", f.factsStartAt, target, null, now));
  }

  const confirm = CONFIRM_TARGET[f.severity];
  if (confirm && resolvedAt && f.status === "RESOLVED") {
    out.push(f.closureConfirmedAt ? done("confirm", "Communicator", resolvedAt, confirm, cals.communicator, f.closureConfirmedAt) : build("confirm", "Communicator", resolvedAt, confirm, cals.communicator, now));
  }

  const chase = PARTNER_CHASE_TARGET[f.severity];
  if (chase && f.isPartnerIssue && !resolved) {
    out.push(build("chase", "Owner", f.lastPartnerContactAt && f.lastPartnerContactAt > f.awareAt ? f.lastPartnerContactAt : f.awareAt, chase, cals.owner, now, { repeating: true }));
  }

  const reply = REPLY_TARGET[f.severity];
  if (reply && isReplyType && !f.isLinkedChild) {
    out.push(f.repliedAt ? done("reply", "Owner", f.awareAt, reply, cals.owner, f.repliedAt) : build("reply", "Owner", f.awareAt, reply, cals.owner, now, { pause }));
  }

  return out;
}

/** Orange: under 60 minutes left, or under 25% of the target left, whichever comes first. Red is overdue (the caller's own rule). Paused and done clocks are never orange. */
export function isSoon(d: Pick<Deadline, "state" | "dueAt" | "share"> & { soonAt?: Date | null }, now: Date): boolean {
  if (d.state !== "open" || !d.dueAt) return false;
  const wallLeft = (d.dueAt.getTime() - now.getTime()) / MS;
  if (wallLeft <= 0) return false;
  if (d.soonAt) return now >= d.soonAt;
  return wallLeft < SOON_MINUTES || (d.share !== null && d.share < SOON_SHARE);
}

/** The colour of a deadline: red once breached, orange when soon, normal otherwise. */
export function deadlineTone(d: Pick<Deadline, "state" | "dueAt" | "share"> & { soonAt?: Date | null }, now: Date): "over" | "soon" | "default" | "paused" | "none" {
  if (d.state === "paused") return "paused";
  if (d.state !== "open" || !d.dueAt) return "none";
  if (d.dueAt.getTime() - now.getTime() <= -MS) return "over";
  return isSoon(d, now) ? "soon" : "default";
}


/** What the facts of an issue are read from: its row, its communications and assessments, and the customer's agreement card. */
export interface DeadlineSource {
  issue: {
    severity: Severity;
    status: IssueStatus;
    type: IssueType;
    communicatorRule: string;
    routingRule: string;
    awareAt: Date;
    notifyRequired: boolean;
    notifiedAt: Date | null;
    restoredAt: Date | null;
    resolvedAt: Date | null;
    waitingOnCustomerSince: Date | null;
    pausedMinutes: number;
    pausedBusinessMinutes: number;
  };
  communications: { type: CommunicationType; occurredAt: Date }[];
  assessments: { outcome: AssessmentOutcome; assessedAt: Date }[];
  card: { factsNeededHours: number | null; regulatoryRegime: RegulatoryRegime | null } | null;
}

const earliest = (dates: Date[]) => dates.reduce<Date | null>((a, d) => (!a || d < a ? d : a), null);
const latest = (dates: Date[]) => dates.reduce<Date | null>((a, d) => (!a || d > a ? d : a), null);

export function deadlineFactsOf(src: DeadlineSource): DeadlineFacts {
  const { issue, communications, assessments, card } = src;
  const isPartnerIssue = issue.communicatorRule === "ISSUE_OWNER_PARTNER";
  const times = (types: CommunicationType[]) => communications.filter((c) => types.includes(c.type)).map((c) => c.occurredAt);
  // Facts for the regulator: Sev-1, Compliance assessed a possible major incident, the customer has a regulatory regime and its contract names the hours.
  const major = assessments.filter((a) => a.outcome === FACTS_FOR_REGULATOR.outcome).map((a) => a.assessedAt);
  const regulated = !!card && card.regulatoryRegime !== null && card.regulatoryRegime !== "NONE";
  const factsRequired = issue.severity === FACTS_FOR_REGULATOR.severity && !isPartnerIssue && regulated && card!.factsNeededHours !== null && major.length > 0;
  return {
    severity: issue.severity,
    status: issue.status,
    type: issue.type,
    isPartnerIssue,
    isLinkedChild: issue.routingRule === "INHERITED_FROM_PARENT",
    awareAt: issue.awareAt,
    notifyRequired: issue.notifyRequired,
    notifiedAt: issue.notifiedAt,
    lastUpdateAt: latest(times(["UPDATE"])),
    restoredAt: issue.restoredAt,
    resolvedAt: issue.resolvedAt,
    closureConfirmedAt: earliest(times(["CLOSURE_CONFIRMED"])),
    repliedAt: earliest(times(["FIRST_NOTIFICATION", "UPDATE"])),
    waitingOnCustomerSince: issue.waitingOnCustomerSince,
    pausedMinutes: issue.pausedMinutes,
    pausedBusinessMinutes: issue.pausedBusinessMinutes,
    factsHours: factsRequired ? card!.factsNeededHours : null,
    factsStartAt: factsRequired ? earliest(major) : null,
    factsSentAt: earliest(times(["FACTS_PACK_SENT"])),
    lastPartnerContactAt: isPartnerIssue ? latest(times(["FIRST_NOTIFICATION", "UPDATE"])) : null,
  };
}
