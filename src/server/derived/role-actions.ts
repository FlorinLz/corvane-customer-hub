import type { IssueStatus, Team } from "@prisma/client";

import { issueDisplayId } from "@/lib/labels";
import { spanText } from "@/lib/time-block";
import { ACK_TARGET, COMPLIANCE_ASSESS_MINUTES, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES } from "@/server/config";
import type { ComputedClocks, StoppedTiming } from "@/server/derived/issue-clocks";
import { stepsFor, type IssueStep, type StepsInput } from "@/server/derived/issue-steps";
import type { Deadline, DeadlineKey } from "@/server/derived/deadlines";
import { addBusinessMinutes, teamCalendar } from "@/lib/business-hours";
import { CONFIRM_TARGET, PARTNER_CHASE_TARGET, REPLY_TARGET, REVIEW_TARGET, RESOLVE_TARGET, RESTORE_TARGET, UPDATE_CADENCE, type Target } from "@/server/config";

// Role actions of an issue, for one viewer. Every issue has a small set of
// actions, each one a person, a verb + object and a deadline; the UI answers
// "what do I do, who has the ball, by when" from this one list. No new
// business rules: each action comes from stepsFor() (the same rules the Home
// "Issues" section and badge already use), run once per role with that role's
// person, and its deadline from the existing clocks.

export type RoleName = "Owner" | "Communicator" | "Compliance";
export type ActionKey =
  | "acknowledge"
  | "acknowledge_on_parent"
  | "notify"
  | "investigate"
  | "close"
  | "assess"
  | "prepare_report"
  | "send_report"
  | "review_report"
  | "resolve"
  // The deadline model (deadlines.ts): each is a step with its own clock.
  | "restore"
  | "update"
  | "facts"
  | "chase"
  | "reply";

/** The keys that come from the deadline model. */
export const DEADLINE_KEYS: ActionKey[] = ["restore", "update", "facts", "chase", "reply"];

/** The order a step happens in: the Action plan's order, and the tie-break between steps with the same deadline. */
export const PROCESS_ORDER: ActionKey[] = ["acknowledge", "acknowledge_on_parent", "notify", "assess", "chase", "reply", "restore", "update", "facts", "investigate", "close", "prepare_report", "review_report", "send_report", "resolve"];
const processIndex = (key: ActionKey) => PROCESS_ORDER.indexOf(key);

export interface ActionPerson {
  id: string;
  name: string;
}

export interface RoleAction {
  key: ActionKey;
  role: RoleName;
  person: ActionPerson;
  /** "Notify" */
  verb: string;
  /** "Revolut Ltd" (the rest of the sentence after the verb; "" when none) */
  object: string;
  /** The step as the issue page words it: "Notify Revolut Ltd of the partner outage". */
  label: string;
  /** The step as Home words it (capitalised; a context line lower-cases the first letter): "Notify Revolut Ltd", "Assess", "Investigate". */
  shortLabel: string;
  dueAt: Date | null;
  /** The deadline is a calendar date, not a time of day (the root cause report): shown "by Mon 19 Oct", no zone label. */
  dateOnly?: boolean;
  /** Set while the issue's clocks have not started yet (rule 4, queued for business hours): the deadline is unknown, not absent. */
  queuedUntil: Date | null;
  /** open: can be done now. blocked: waits for an earlier step. done: completed. */
  state: "open" | "blocked" | "done";
  /** The line under the step in the Action plan: "Required by the customer contract: 14 days after resolution". */
  subLine?: string;
  /** The small line under "No deadline": "until resolved", "after resolution". */
  afterNote?: string;
  /** blocked only: "Starts when ISS-1045 is resolved". */
  startsWhen?: string;
  /** How Home words this step when somebody else waits on it ("Waiting on Mei Chen (Compliance): Approve the report"). */
  waitLabel?: string;
  /** The Action plan sub-line ends with this date: "Approve before the report is sent, by Mon 19 Oct". */
  subLineBy?: Date | null;
  /** blocked only: the days a root cause report will be due after resolution (null: the contract names none). */
  plannedDays?: number | null;
  /** A waiting step's target in words ("1 business day"), or null when it has none. Unset: the plan falls back to the report's days. */
  plannedText?: string | null;
  /** notify only, while the on-call person still communicates: when it passes to the customer owner. */
  onCallUntil?: Date | null;
  /** state "done" only. */
  done?: {
    label: string;
    byName: string | null;
    at: Date;
    /** What the elapsed time is measured from ("Corvane became aware", "the flag"), and how it compared to the target: the audit evidence. */
    since?: string;
    timing?: StoppedTiming;
    /** The root cause report: to whom, by which team, and the link (the Done line reads differently). */
    report?: { to: string | null; team: Team | null; url: string | null };
    /** The team of the person who did it, when the line names it: "Root cause report approved by Mei Chen (Compliance) at ...". */
    byTeam?: Team | null;
  };
  /** The partner issue this action is carried out on (a linked issue's owner action). */
  via?: { id: string; number: number };
  /** The short name of the clock, for the Home time column: "Restore", "Update", "Chase". */
  timeLabel: string;
  /** Waiting on customer holds this clock: since when, and why. `dueAt` is then null. */
  paused?: { since: Date; label: string };
  /** The clock behind `dueAt`, when it is one of the deadline model's: its target and how much of it is left (for the orange rule). */
  clock?: { key: DeadlineKey; targetMinutes: number; share: number | null; soonAt: Date | null; repeating: boolean; startAt: Date };
  /** restore and facts: the note the person recorded, shown on the Done line. */
  doneNote?: string | null;
}

export interface RoleActionIssue {
  issueId: string;
  number: number;
  status: IssueStatus;
  severity: StepsInput["severity"];
  entityName: string;
  /** communicatorRule ISSUE_OWNER_PARTNER: this issue is the partner's own outage. */
  isPartnerIssue: boolean;
  owner: ActionPerson | null;
  communicator: ActionPerson | null;
  /** Only the assigned assessor ever holds the Compliance action. */
  complianceAssessor: ActionPerson | null;
  contributorIds: string[];
  clocksStartAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedByName: string | null;
  notifyRequired: boolean;
  notifiedAt: Date | null;
  notifiedByName: string | null;
  /** The notification target this issue runs on: the contract's hours (Sev-1), or the default; Sev-2 counts business minutes. */
  notifyTargetHours?: number | null;
  notifyDefaultTarget?: boolean;
  notifyTargetBusinessMins?: number | null;
  communicatorRule?: string;
  handoverAt?: Date | null;
  complianceFlaggedAt: Date | null;
  complianceClosedAt: Date | null;
  complianceVisibleFrom: Date | null;
  firstAssessment: { at: Date; byName: string | null } | null;
  /** M27: when and by whom the issue was resolved (a Done line of its own), and the partner issue it was resolved with, if any. */
  resolved?: { at: Date; byId: string | null; byName: string | null; viaNumber?: number | null } | null;
  /** The resolution confirmed with the customer (the partner): when, and by whom. The issue stays Resolved until every step is done. */
  closure?: { at: Date; byName: string | null } | null;
  /** M27: the root cause report task, when the issue has one. */
  reportTask?: {
    reportDays?: number | null;
    dueAt: Date | null;
    sentAt: Date | null;
    sentToName: string | null;
    sentByName: string | null;
    sentByTeam: Team | null;
    reportUrl: string | null;
    /** Compliance's approval, before the report is sent: who actually approved, and when. */
    approvedAt?: Date | null;
    approvedByName?: string | null;
    approvedByTeam?: Team | null;
    /** The owner's draft (the first of the three steps): shared at, by whom. Cleared when Compliance asks for changes. */
    draftSharedAt?: Date | null;
    draftSharedByName?: string | null;
    /** Compliance asked for changes on the previous draft: who, and why. Cleared when a new draft is shared. */
    changesRequest?: { byName: string | null; reason: string } | null;
  } | null;
  /** M27 AC4: the entity's named Compliance person, who reviews the report before it is sent. */
  reportReviewer?: ActionPerson | null;
  /**
   * Show the steps that wait for an earlier one (the Action plan does; Home does not). `reportPlan` says a root cause report
   * task WILL be created at resolution (Sev-1 customer issue, regime captured and not None), with the days the card gives.
   */
  planned?: boolean;
  reportPlan?: { days: number | null } | null;
  /** The partner issue a CREATED linked issue inherits its owner and acknowledgement from (routingRule INHERITED_FROM_PARENT). */
  /** `ackDueAt`: the partner issue's own acknowledge deadline, which the linked issue's "Acknowledge on ISS-n" mirrors. */
  inheritedFrom: { id: string; number: number; entityName: string; acknowledgedAt: Date | null; acknowledgedByName: string | null; ackDueAt?: Date | null } | null;
  clocks: ComputedClocks;
  /** The deadline model's clocks at `now` (deadlines.ts), for the steps that have one. Absent: none of them is shown. */
  deadlines?: Deadline[];
  /** Service restored, as the owner recorded it. */
  restored?: { at: Date; byName: string | null; note: string | null } | null;
  /** The facts pack, as the communicator recorded it. */
  factsSent?: { at: Date; byName: string | null } | null;
  /** The first reply to the customer (BILLING, COMMERCIAL_COVERAGE). */
  reply?: { at: Date; byName: string | null } | null;
}

export interface RoleActionsView {
  /** Steps that can be done now, by deadline (overdue first; no deadline last), then in process order: what "Your next action" and Home read. */
  open: RoleAction[];
  /** Steps that wait for an earlier one, in process order. */
  blocked: RoleAction[];
  done: RoleAction[];
  /**
   * The Action plan's order, the same for every viewer: the process order (acknowledge, notify, assess, investigate and resolve, confirm
   * the resolution, prepare, approve and send the report), waiting steps in their own place. Home keeps its own rule (your actions first).
   */
  plan: RoleAction[];
  /** Open actions the viewer owns. */
  mine: RoleAction[];
  /** Open actions somebody else owns. */
  others: RoleAction[];
  /** The viewer has nothing to do but holds a role: the most urgent open action of someone else. */
  waitingOn: RoleAction | null;
  /** The most urgent open action on the issue, whoever owns it. */
  mostUrgent: RoleAction | null;
  /** "Your next action": the viewer's most urgent open step, or, with none, the next step of somebody else. */
  next: { mine: RoleAction | null; other: RoleAction | null };
}

/** Earliest deadline first; no deadline last; ties keep their input order. */
export function byDeadline(a: { dueAt: Date | null }, b: { dueAt: Date | null }): number {
  if (a.dueAt === null && b.dueAt === null) return 0;
  if (a.dueAt === null) return 1;
  if (b.dueAt === null) return -1;
  return a.dueAt.getTime() - b.dueAt.getTime();
}

const byDeadlineThenProcess = (a: RoleAction, b: RoleAction) => byDeadline(a, b) || processIndex(a.key) - processIndex(b.key);

function businessLabel(minutes: number): string {
  if (minutes === 540) return "1 business day";
  if (minutes === 1620) return "3 business days";
  if (minutes % 60 === 0) return `${minutes / 60} business hours`;
  return `${minutes} business minutes`;
}

interface Wording {
  label: string;
  shortLabel: string;
  subLine?: string;
  afterNote?: string;
}

/** How each step reads on the issue page (label, sub-line, the small line when it has no deadline) and on Home (shortLabel). */
function wording(key: ActionKey, issue: RoleActionIssue, blocked: boolean): Wording {
  const parent = issue.inheritedFrom;
  const display = issueDisplayId(issue.number);
  switch (key) {
    case "acknowledge": {
      const t = ACK_TARGET[issue.severity];
      return { label: `Acknowledge ${display}`, shortLabel: `Acknowledge ${display}`, subLine: blocked ? undefined : `${t.business ? businessLabel(t.minutes) : spanText(t.minutes)} after Corvane aware at` };
    }
    case "acknowledge_on_parent":
      return { label: `Acknowledge on ${issueDisplayId(parent!.number)}`, shortLabel: `Acknowledge on ${issueDisplayId(parent!.number)}` };
    case "notify": {
      let subLine: string | undefined;
      if (issue.severity === "SEV1") {
        subLine = issue.notifyTargetHours != null && !issue.notifyDefaultTarget ? `Required by the customer contract: notify the customer within ${spanText(issue.notifyTargetHours * 60)}` : issue.notifyTargetHours != null ? `${spanText(issue.notifyTargetHours * 60)} after Corvane aware at` : undefined;
      } else if (issue.severity === "SEV2") {
        subLine = `${businessLabel(issue.notifyTargetBusinessMins ?? NOTIFY_TARGET_SEV2_BUSINESS_MINUTES)} after Corvane aware at`;
      }
      return { label: parent ? `Notify ${issue.entityName} of the partner outage` : `Notify ${issue.entityName}`, shortLabel: `Notify ${issue.entityName}`, subLine };
    }
    case "assess":
      return { label: "Assess for Compliance", shortLabel: "Assess", subLine: blocked ? undefined : `${spanText(COMPLIANCE_ASSESS_MINUTES)} after the Compliance flag` };
    case "investigate":
      if (parent) return { label: `Investigate with ${parent.entityName} and resolve on ${issueDisplayId(parent.number)}`, shortLabel: `Investigate with ${parent.entityName} and resolve`, afterNote: blocked ? "after acknowledgement" : "until resolved" };
      if (issue.isPartnerIssue) return { label: `Investigate with ${issue.entityName} and resolve`, shortLabel: `Investigate with ${issue.entityName} and resolve`, afterNote: blocked ? "after acknowledgement" : "until resolved" };
      // Once the service is restored the owner is watching it, not looking for the cause.
      if (issue.restored) return { label: `Monitor and resolve ${display}`, shortLabel: "Monitor and resolve", afterNote: blocked ? "after acknowledgement" : "until resolved" };
      return { label: `Investigate and resolve ${display}`, shortLabel: "Investigate", afterNote: blocked ? "after acknowledgement" : "until resolved" };
    case "prepare_report": {
      // Open: the days the contract gave when the task was created (read once). Planned: set by the caller from the card.
      const days = issue.reportTask ? (issue.reportTask.reportDays ?? null) : undefined;
      const contract = days === undefined ? undefined : days !== null ? `Required by the customer contract: ${days} days after resolution` : "The contract has no report period: 10 business days after resolution";
      const changes = issue.reportTask?.changesRequest;
      const subLine = changes ? `Changes requested by ${changes.byName ?? "Compliance"}: ${changes.reason}` : contract;
      return { label: `Prepare root cause report for ${issue.entityName}`, shortLabel: `Prepare root cause report for ${issue.entityName}`, subLine };
    }
    case "send_report":
      return { label: `Send approved report to ${issue.entityName}`, shortLabel: `Send approved report to ${issue.entityName}` };
    case "review_report":
      return { label: "Approve root cause report", shortLabel: "Approve root cause report", subLine: "Approve before the report is sent", afterNote: blocked ? "after the draft is shared" : "until approved" };
    case "close": {
      // On the partner issue the communicator speaks to the partner, not a customer.
      const who = issue.isPartnerIssue ? "partner" : "customer";
      return { label: `Confirm resolution with the ${who}`, shortLabel: `Confirm resolution with the ${who}`, subLine: "After resolution", afterNote: blocked ? "after resolution" : "until confirmed" };
    }
    case "restore": {
      const t = RESTORE_TARGET[issue.severity];
      return { label: "Restore service", shortLabel: "Restore service", subLine: t ? `${targetText(t)} after Corvane aware at` : undefined, afterNote: blocked ? "after acknowledgement" : undefined };
    }
    case "update": {
      const c = UPDATE_CADENCE[issue.severity];
      const subLine = c ? (c.beforeRestore.minutes === c.afterRestore.minutes && c.beforeRestore.business === c.afterRestore.business ? `Every ${targetText(c.beforeRestore)} until resolved` : `Every ${targetText(c.beforeRestore)} until the service is restored, then every ${targetText(c.afterRestore)}`) : undefined;
      return { label: `Send update to ${issue.entityName}`, shortLabel: `Send update to ${issue.entityName}`, subLine };
    }
    case "facts":
      return { label: `Send facts for ${issue.entityName}'s regulator`, shortLabel: "Send facts to the regulator", subLine: "Required by the customer contract, after Compliance assessed a possible major incident" };
    case "chase": {
      const t = PARTNER_CHASE_TARGET[issue.severity];
      return { label: `Chase ${issue.entityName}`, shortLabel: `Chase ${issue.entityName}`, subLine: t ? `Every ${targetText(t)}, restarts at each contact with the partner` : undefined };
    }
    case "reply": {
      const t = REPLY_TARGET[issue.severity];
      return { label: `Reply to ${issue.entityName}`, shortLabel: "Reply to customer", subLine: t ? `${targetText(t)} after Corvane aware at` : undefined };
    }
    default:
      return { label: "Resolve", shortLabel: "Resolve" };
  }
}

/** A target as the plan writes it: "4 h", "60 min", "1 business day", "4 business hours", "5 business days". */
function targetText(t: Target): string {
  if (!t.business) return spanText(t.minutes);
  if (t.minutes % 540 === 0) {
    const days = t.minutes / 540;
    return `${days} business day${days === 1 ? "" : "s"}`;
  }
  return businessLabel(t.minutes);
}

/** How a clock is named in the Home time column: "Kevin Lim · 3 h 40 min · Restore". */
const TIME_LABELS: Record<ActionKey, string> = {
  acknowledge: "Acknowledge",
  acknowledge_on_parent: "Acknowledge",
  notify: "Notify",
  assess: "Assess",
  restore: "Restore",
  update: "Update",
  facts: "Facts",
  chase: "Chase",
  reply: "Reply",
  investigate: "Resolve",
  close: "Confirm",
  prepare_report: "Report",
  review_report: "Approve report",
  send_report: "Report",
  resolve: "Resolve",
};

function build(key: ActionKey, role: RoleName, person: ActionPerson, verb: string, object: string, issue: RoleActionIssue, step: IssueStep | null, queuedUntil: Date | null, blocked = false): RoleAction {
  const w = wording(key, issue, blocked);
  return {
    timeLabel: TIME_LABELS[key],
    key,
    role,
    person,
    verb,
    object,
    label: w.label,
    shortLabel: w.shortLabel,
    subLine: w.subLine,
    afterNote: w.afterNote,
    waitLabel: key === "review_report" ? "Approve the report" : key === "prepare_report" ? "Share the draft" : key === "send_report" ? "Send approved report" : undefined,
    dueAt: step?.dueAt ?? null,
    queuedUntil: step?.dueAt ? null : queuedUntil,
    state: blocked ? "blocked" : "open",
    ...(blocked ? plannedTextOf(key, issue) : {}),
  };
}

/** What a waiting step's time column says before it starts: its target, or nothing when it has none. */
function plannedTextOf(key: ActionKey, issue: RoleActionIssue): { plannedText: string | null } | Record<string, never> {
  if (key === "close") {
    const t = CONFIRM_TARGET[issue.severity];
    return { plannedText: t ? targetText(t) : null };
  }
  if (key === "review_report") return { plannedText: targetText(REVIEW_TARGET) };
  return {};
}

const deadlineOf = (issue: RoleActionIssue, key: DeadlineKey): Deadline | null => issue.deadlines?.find((d) => d.key === key) ?? null;

/** Puts a deadline's due time (or its pause) and clock on an action. A paused clock has no due time: Waiting on customer holds it. */
function withClock(a: RoleAction, d: Deadline): RoleAction {
  const clock = { key: d.key, targetMinutes: d.targetMinutes, share: d.share, soonAt: d.soonAt, repeating: d.repeating, startAt: d.startAt };
  if (d.state === "paused") return { ...a, dueAt: null, paused: { since: d.pausedSince!, label: d.pausedFor ?? "Waiting on customer" }, clock };
  return { ...a, dueAt: d.dueAt, clock, queuedUntil: null };
}

/** Every role action on the issue (open, blocked when `issue.planned`, and done), in role order owner, communicator, compliance. */
export function allRoleActions(issue: RoleActionIssue, now: Date): RoleAction[] {
  const actions: RoleAction[] = [];
  const queuedUntil = now < issue.clocksStartAt ? issue.clocksStartAt : null;
  const unresolved = issue.status !== "RESOLVED" && issue.status !== "CLOSED";
  const input: StepsInput = {
    status: issue.status,
    notifyRequired: issue.notifyRequired,
    severity: issue.severity,
    notifiedAt: issue.notifiedAt,
    complianceFlaggedAt: issue.complianceFlaggedAt,
    complianceClosedAt: issue.complianceClosedAt,
    firstAssessmentAt: issue.firstAssessment?.at ?? null,
    complianceVisibleFrom: issue.complianceVisibleFrom,
    resolutionConfirmed: !!issue.closure,
    reportTask: issue.reportTask ? { dueAt: issue.reportTask.dueAt, sent: !!issue.reportTask.sentAt, approved: !!issue.reportTask.approvedAt, draftShared: !!issue.reportTask.draftSharedAt } : null,
  };
  const stepsOf = (person: ActionPerson | null, roles: { isOwner?: boolean; isCommunicator?: boolean; isComplianceAssessor?: boolean; isReportReviewer?: boolean }) =>
    person ? stepsFor(input, { isOwner: !!roles.isOwner, isCommunicator: !!roles.isCommunicator, isComplianceAssessor: !!roles.isComplianceAssessor, isReportReviewer: !!roles.isReportReviewer }, issue.clocks, now) : [];
  const find = (steps: IssueStep[], text: string) => steps.find((s) => s.text === text) ?? null;
  const parent = issue.inheritedFrom;
  const startsWhenResolved = `Starts when ${issueDisplayId(parent?.number ?? issue.number)} is resolved`;

  // Owner: Acknowledge (own, or on the partner issue for a linked one), then Investigate. "Resolve" is the same action as Investigate, with no deadline.
  if (issue.owner) {
    const steps = stepsOf(issue.owner, { isOwner: true });
    if (parent) {
      if (parent.acknowledgedAt) {
        actions.push({
          ...build("acknowledge_on_parent", "Owner", issue.owner, "Acknowledge", `on ${issueDisplayId(parent.number)}`, issue, null, null),
          state: "done",
          done: { label: `Acknowledged via ${issueDisplayId(parent.number)}`, byName: parent.acknowledgedByName, at: parent.acknowledgedAt, since: "Corvane became aware", timing: parentAckTiming(issue.severity, parent) },
          via: { id: parent.id, number: parent.number },
        });
      } else if (unresolved) {
        // The step mirrors the partner issue's own acknowledge clock: its deadline (overdue and soon states, sorting) is the partner issue's.
        actions.push({ ...build("acknowledge_on_parent", "Owner", issue.owner, "Acknowledge", `on ${issueDisplayId(parent.number)}`, issue, null, null), dueAt: parent.ackDueAt ?? null, via: { id: parent.id, number: parent.number } });
      }
    } else {
      const ack = find(steps, "Acknowledge");
      if (ack) actions.push(build("acknowledge", "Owner", issue.owner, "Acknowledge", issueDisplayId(issue.number), issue, ack, queuedUntil));
      else if (issue.acknowledgedAt) {
        actions.push({
          ...build("acknowledge", "Owner", issue.owner, "Acknowledge", issueDisplayId(issue.number), issue, null, null),
          state: "done",
          done: { label: "Acknowledged", byName: issue.acknowledgedByName, at: issue.acknowledgedAt, since: "Corvane became aware", timing: issue.clocks.acknowledge.stopped },
        });
      }
    }
    // Restore service, then (on a partner issue) Chase the partner, and (BILLING, COMMERCIAL_COVERAGE) Reply to the customer: the owner's other clocks.
    for (const key of ["restore", "chase", "reply"] as const) {
      const clock = deadlineOf(issue, key);
      if (!clock) continue;
      const verb = key === "restore" ? "Restore" : key === "chase" ? "Chase" : "Reply";
      const object = key === "restore" ? "service" : issue.entityName;
      if (clock.state === "done") {
        const rec = key === "restore" ? issue.restored : key === "reply" ? issue.reply : null;
        if (rec) {
          actions.push({
            ...build(key, "Owner", issue.owner, verb, object, issue, null, null),
            state: "done",
            done: {
              label: key === "restore" ? "Service restored" : "Replied to the customer",
              byName: rec.byName,
              at: rec.at,
              since: "Corvane became aware",
              timing: clock.stopped ? { elapsedMinutes: clock.stopped.elapsedMinutes, targetText: targetText({ minutes: clock.targetMinutes, business: clock.business }), lateMinutes: clock.stopped.lateMinutes } : undefined,
            },
            doneNote: key === "restore" ? (issue.restored?.note ?? null) : null,
          });
        }
      } else if (issue.status === "NEW" && key !== "reply") {
        // Not before the owner has acknowledged (Resolve and Restore need it); the clock is running, so the Action plan shows its deadline.
        if (issue.planned) {
          const a = withClock(build(key, "Owner", issue.owner, verb, object, issue, null, null, true), clock);
          a.startsWhen = `Starts when ${issueDisplayId(parent?.number ?? issue.number)} is acknowledged`;
          actions.push(a);
        }
      } else {
        actions.push(withClock(build(key, "Owner", issue.owner, verb, object, issue, null, queuedUntil), clock));
      }
    }
    const resolve = find(steps, "Resolve");
    if (resolve) {
      let a = build("investigate", "Owner", issue.owner, "Investigate", "", issue, resolve, null);
      const resolveClock = deadlineOf(issue, "resolve");
      if (resolveClock && resolveClock.state !== "done") a = { ...withClock(a, resolveClock), subLine: `${targetText(RESOLVE_TARGET[issue.severity]!)} after Corvane aware at`, afterNote: undefined };
      if (parent) a.via = { id: parent.id, number: parent.number };
      actions.push(a);
    } else if (issue.planned && issue.status === "NEW") {
      const a = build("investigate", "Owner", issue.owner, "Investigate", "", issue, null, null, true);
      a.startsWhen = `Starts when ${issueDisplayId(parent?.number ?? issue.number)} is acknowledged`;
      if (parent) a.via = { id: parent.id, number: parent.number };
      actions.push(a);
    }
    // The owner's root cause report, in three steps: Prepare (share a draft), then Compliance approves, then Send approved report. Each is open only
    // when it is that person's turn; the others wait. Planned (before the issue is resolved) they are all waiting.
    const task = issue.reportTask;
    if (task) {
      const prepare = find(steps, "Prepare root cause report");
      const send = find(steps, "Send approved report");
      if (prepare) actions.push({ ...build("prepare_report", "Owner", issue.owner, "Prepare", "", issue, prepare, null), dateOnly: true });
      else if (task.draftSharedAt) {
        actions.push({
          ...build("prepare_report", "Owner", issue.owner, "Prepare", "", issue, null, null),
          state: "done",
          done: { label: "Draft shared", byName: task.draftSharedByName ?? null, at: task.draftSharedAt },
        });
      }
      if (send) actions.push({ ...build("send_report", "Owner", issue.owner, "Send", "", issue, send, null), dateOnly: true });
      else if (!task.sentAt) {
        // Waits for Compliance's approval: the deadline stays visible, there is no Record report sent button.
        const a = build("send_report", "Owner", issue.owner, "Send", "", issue, null, null, true);
        a.startsWhen = `Starts when ${issue.reportReviewer?.name ?? "Compliance"} approves`;
        a.dueAt = task.dueAt;
        a.dateOnly = true;
        actions.push(a);
      } else {
        actions.push({
          ...build("send_report", "Owner", issue.owner, "Send", "", issue, null, null),
          state: "done",
          done: { label: "Root cause report sent", byName: task.sentByName, at: task.sentAt, report: { to: task.sentToName, team: task.sentByTeam, url: task.reportUrl } },
        });
      }
    } else if (issue.planned && unresolved && issue.reportPlan) {
      const days = issue.reportPlan.days;
      for (const key of ["prepare_report", "send_report"] as const) {
        const a = build(key, "Owner", issue.owner, key === "prepare_report" ? "Prepare" : "Send", "", issue, null, null, true);
        a.startsWhen = startsWhenResolved;
        a.plannedDays = days;
        a.subLine = key === "prepare_report" ? (days !== null ? `Required by the customer contract: ${days} days after resolution` : "The contract has no report period: 10 business days after resolution") : undefined;
        actions.push(a);
      }
    }
  }
  if (issue.resolved && (issue.status === "RESOLVED" || issue.status === "CLOSED")) {
    const via = issue.resolved.viaNumber ?? null;
    actions.push({
      key: "resolve",
      role: "Owner",
      person: { id: issue.resolved.byId ?? issue.owner?.id ?? "", name: issue.resolved.byName ?? issue.owner?.name ?? "" },
      verb: "Resolve",
      object: "",
      label: "Resolve",
      shortLabel: "Resolve",
      timeLabel: TIME_LABELS.resolve,
      dueAt: null,
      queuedUntil: null,
      state: "done",
      done: { label: via ? `Resolved via ${issueDisplayId(via)}` : "Resolved", byName: issue.resolved.byName, at: issue.resolved.at },
    });
  }

  // Communicator: Notify the customer, then Confirm resolution with the customer once Resolved (planned before that).
  if (issue.communicator) {
    const steps = stepsOf(issue.communicator, { isCommunicator: true });
    const notify = find(steps, "Notify customer");
    if (notify) {
      const a = build("notify", "Communicator", issue.communicator, "Notify", issue.entityName, issue, notify, queuedUntil);
      if (issue.communicatorRule === "ISSUE_OWNER_UNTIL_HANDOVER" && issue.handoverAt && now < issue.handoverAt) a.onCallUntil = issue.handoverAt;
      actions.push(a);
    } else if (issue.notifyRequired && issue.notifiedAt) {
      actions.push({
        ...build("notify", "Communicator", issue.communicator, "Notify", issue.entityName, issue, null, null),
        state: "done",
        done: { label: issue.isPartnerIssue ? "Partner notified" : "Customer notified", byName: issue.notifiedByName, at: issue.notifiedAt, since: "Corvane became aware", timing: issue.clocks.notify.stopped },
      });
    }
    // The customer is told again and again until the issue is resolved (Update), and, for a regulated bank that needs facts for its regulator, once (Facts).
    const update = deadlineOf(issue, "update");
    if (update && update.state !== "done") actions.push(withClock(build("update", "Communicator", issue.communicator, "Send", `update to ${issue.entityName}`, issue, null, null), update));
    const facts = deadlineOf(issue, "facts");
    if (facts?.state === "done" && issue.factsSent) {
      actions.push({
        ...build("facts", "Communicator", issue.communicator, "Send", "facts to the regulator", issue, null, null),
        state: "done",
        done: {
          label: "Facts sent to the regulator",
          byName: issue.factsSent.byName,
          at: issue.factsSent.at,
          since: "the Compliance assessment",
          timing: facts.stopped ? { elapsedMinutes: facts.stopped.elapsedMinutes, targetText: targetText({ minutes: facts.targetMinutes, business: false }), lateMinutes: facts.stopped.lateMinutes } : undefined,
        },
      });
    } else if (facts) actions.push(withClock(build("facts", "Communicator", issue.communicator, "Send", "facts to the regulator", issue, null, null), facts));
    const close = find(steps, "Confirm resolution with the customer");
    if (close) {
      const a = build("close", "Communicator", issue.communicator, "Confirm", "resolution with the customer", issue, close, null);
      const confirm = deadlineOf(issue, "confirm");
      actions.push(confirm && confirm.state === "open" ? { ...withClock(a, confirm), afterNote: undefined } : a);
    }
    if (!close && issue.closure) {
      actions.push({
        ...build("close", "Communicator", issue.communicator, "Confirm", "resolution with the customer", issue, null, null),
        state: "done",
        done: { label: "Resolution confirmed", byName: issue.closure.byName, at: issue.closure.at },
      });
    } else if (issue.planned && unresolved) {
      const a = build("close", "Communicator", issue.communicator, "Confirm", "resolution with the customer", issue, null, null, true);
      a.startsWhen = startsWhenResolved;
      actions.push(a);
    }
  }

  // Compliance: the assigned assessor's first assessment.
  if (issue.complianceAssessor) {
    const steps = stepsOf(issue.complianceAssessor, { isComplianceAssessor: true });
    const assess = find(steps, "Assess for Compliance");
    if (assess) actions.push(build("assess", "Compliance", issue.complianceAssessor, "Assess", "for Compliance", issue, assess, null));
    else if (issue.firstAssessment) {
      actions.push({
        ...build("assess", "Compliance", issue.complianceAssessor, "Assess", "for Compliance", issue, null, null),
        state: "done",
        done: { label: "Assessed for Compliance", byName: issue.firstAssessment.byName, at: issue.firstAssessment.at, since: "the flag", timing: issue.clocks.compliance?.stopped },
      });
    }
  }

  // Compliance approves the report (or asks for changes) once the owner has shared the draft: waiting before that, then open by the report's deadline.
  // The step stays assigned to the entity's Compliance person; any Compliance-team user can act. The Done line names whoever actually approved.
  const reviewer = issue.reportReviewer;
  if (reviewer && reviewer.id !== issue.owner?.id) {
    const task = issue.reportTask;
    if (task && !task.approvedAt && !task.sentAt) {
      if (task.draftSharedAt) {
        const steps = stepsOf(reviewer, { isReportReviewer: true });
        const review = find(steps, "Approve root cause report");
        const built = build("review_report", "Compliance", reviewer, "Approve", "the report", issue, review, null);
        const byTarget = addBusinessMinutes(task.draftSharedAt, REVIEW_TARGET.minutes, teamCalendar("COMPLIANCE"));
        const due = task.dueAt && task.dueAt < byTarget ? task.dueAt : byTarget; // never later than the report's own date
        actions.push({ ...built, dueAt: due, dateOnly: true, subLineBy: task.dueAt });
      } else {
        const a = build("review_report", "Compliance", reviewer, "Approve", "the report", issue, null, null, true);
        a.startsWhen = `Starts when ${issue.owner?.name ?? "the owner"} shares the draft`;
        actions.push(a); // no date yet: 3 business days after the draft is shared
      }
    } else if (task?.approvedAt) {
      actions.push({
        ...build("review_report", "Compliance", reviewer, "Approve", "the report", issue, null, null),
        state: "done",
        done: { label: "Root cause report approved", byName: task.approvedByName ?? null, at: task.approvedAt, byTeam: task.approvedByTeam ?? null },
      });
    } else if (issue.planned && unresolved && issue.reportPlan) {
      const a = build("review_report", "Compliance", reviewer, "Approve", "the report", issue, null, null, true);
      a.startsWhen = startsWhenResolved;
      actions.push(a);
    }
  }

  return actions;
}

/** The role actions of one issue as one viewer sees them. */
export function roleActionsFor(issue: RoleActionIssue, viewerId: string, now: Date): RoleActionsView {
  const all = allRoleActions(issue, now);
  const open = all.filter((a) => a.state === "open").sort(byDeadlineThenProcess);
  const blocked = all.filter((a) => a.state === "blocked").sort((a, b) => processIndex(a.key) - processIndex(b.key));
  // The Action plan: the process order, the same for every viewer, open and waiting steps together (the deadline rides on each row).
  const plan = [...open, ...blocked].sort((a, b) => processIndex(a.key) - processIndex(b.key));
  // Chronological, to the minute (the forms take minutes: a report "sent at 16:48" is not before a resolution at 16:48:30); within a minute, the order things happen in.
  const minute = (d: Date) => Math.floor(d.getTime() / 60_000);
  // Within a minute, the order things happen in: the acknowledgement, the resolution, the report, the review of it.
  const DONE_ORDER: ActionKey[] = ["acknowledge", "acknowledge_on_parent", "notify", "assess", "investigate", "resolve", "close", "prepare_report", "review_report", "send_report"];
  const done = all
    .filter((a) => a.state === "done")
    .sort((a, b) => minute(a.done!.at) - minute(b.done!.at) || DONE_ORDER.indexOf(a.key) - DONE_ORDER.indexOf(b.key));
  const mine = open.filter((a) => a.person.id === viewerId);
  const others = open.filter((a) => a.person.id !== viewerId);
  return {
    open,
    blocked,
    done,
    plan,
    mine,
    others,
    waitingOn: mine.length === 0 ? (others[0] ?? null) : null,
    mostUrgent: open[0] ?? null,
    next: { mine: mine[0] ?? null, other: mine.length === 0 ? (others[0] ?? null) : null },
  };
}

/**
 * A linked issue's "Acknowledged via ISS-n" Done line reads like every other: how long after Corvane became aware, the target and whether
 * it was on time. The linked issue mirrors the partner issue's acknowledge clock, so its deadline is the partner issue's (`ackDueAt`).
 * Only for a wall-clock target (Sev-1, Sev-2): a business-hours target needs the owner's calendar.
 */
function parentAckTiming(severity: StepsInput["severity"], parent: { acknowledgedAt: Date | null; ackDueAt?: Date | null }): StoppedTiming | undefined {
  const target = ACK_TARGET[severity];
  if (target.business || !parent.acknowledgedAt || !parent.ackDueAt) return undefined;
  const pastDue = (parent.acknowledgedAt.getTime() - parent.ackDueAt.getTime()) / 60_000;
  return { elapsedMinutes: target.minutes + pastDue, targetText: spanText(target.minutes), lateMinutes: pastDue > 0 ? pastDue : null };
}

export interface HomeSortKey {
  /** The issue is Resolved or Closed (it is only on Home for a step still to do): such rows come after every open issue. */
  finished?: boolean;
  /** The viewer has an open action (rows where they only wait come last). */
  hasAction: boolean;
  /** The viewer's own earliest deadline, null when none. */
  dueAt: Date | null;
  severity: StepsInput["severity"];
  awareAt: Date;
  number: number;
}

/** Home sort, every scope: open issues before Resolved or Closed ones; then own actions first; then deadline (overdue first, none last); then severity; then the older issue. */
export function compareHomeRows(a: HomeSortKey, b: HomeSortKey): number {
  return (
    Number(!!a.finished) - Number(!!b.finished) ||
    Number(b.hasAction) - Number(a.hasAction) ||
    byDeadline(a, b) ||
    Number(a.severity.slice(3)) - Number(b.severity.slice(3)) ||
    a.awareAt.getTime() - b.awareAt.getTime() ||
    a.number - b.number
  );
}
