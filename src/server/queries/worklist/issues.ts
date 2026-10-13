import type { Scheme, Severity, Team } from "@prisma/client";

import { db } from "@/server/db";
import { now as nowFn } from "@/lib/dates";
import { formatInZone } from "@/lib/time-zones";
import { effectiveTimeZone, teamCalendar, userCalendar, type Calendar } from "@/lib/business-hours";
import { firstLine } from "@/lib/issue-text";
import { ISSUE_TYPE_LABELS, SCHEME_LABELS, TEAM_LABELS, ISSUE_STATUS_LABELS, issueDisplayId } from "@/lib/labels";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { ackDueAtOf, computeClocks, type IssueClockFields } from "@/server/derived/issue-clocks";
import { stepsFor, roleLabel, leadingStep } from "@/server/derived/issue-steps";
import { roleActionsFor, compareHomeRows, type HomeSortKey, type RoleActionIssue, type RoleActionsView, type RoleName } from "@/server/derived/role-actions";

// Brief 4.6.9, M20 AC1-AC13, M18 AC10. The Home "Issues" section's one
// data source, shared by its own refresh endpoint (GET
// /api/worklist/issues) and the Home badge's own small poll of the
// same endpoint.

/** One other person's open action, for line 2 of a Home row. Times are formatted in the browser, from `dueAt` and the server clock. */
export interface RoleLine {
  role: RoleName;
  person: string;
  label: string;
  dueAt: string | null; // ISO
}

/** What the new Home issue row shows: time block, line 1, line 2 and the right column. */
export interface RowView {
  scope: "mine" | "team";
  /** The deadline in the time block: the viewer's own (Mine) or the most urgent open one on the issue (My team). */
  timeDueAt: string | null; // ISO
  /** My team only: whose deadline the time block shows. Mine shows "for you" when there is none. */
  timePerson: string | null;
  line1:
    | { kind: "own"; label: string }
    | { kind: "waiting"; role: RoleName; person: string; label: string }
    | { kind: "person"; person: string; label: string }
    | { kind: "none" };
  line2: RoleLine[];
  hasAction: boolean;
  linkedTo: string | null; // "ISS-1045"
  productLine: string | null; // "UK CoP / GB"
  /** Resolved or Closed (a row only stays on Home in those statuses for its root cause report): shown in the right column. */
  statusNote: string | null;
  /** The time block's deadline is a calendar date (root cause report): "by Mon 19 Oct". */
  timeDateOnly: boolean;
  entityName: string;
  /** Home table: the issue type, the first line of its description, and whether the issue is a partner issue (the customer column tags it "Partner"). */
  typeLabel: string;
  descriptionLine: string;
  isPartner: boolean;
}

export interface MainRow {
  issueId: string;
  number: number;
  typeLabel: string;
  entityName: string;
  entityCountry: string | null;
  schemeCountry: string | null;
  statusLabel: string;
  roleLabel: string;
  stepText: string | null;
  stepClockText: string | null;
  stepOverdue: boolean;
  moreStepsCount: number;
  dueAt: string | null; // ISO
  severity: Severity;
  awareAt: string; // ISO
  personName?: string; // "My team" scope only (AC11)
  view: RowView;
}

export interface ContributingRow {
  issueId: string;
  number: number;
  entityName: string;
  statusLabel: string;
  ownerLabel: string;
  severity: Severity;
  view: RowView;
}

export interface ReportedRow {
  issueId: string;
  number: number;
  entityName: string;
  statusLabel: string;
  ownerLabel: string;
  communicatorLabel: string;
  queuedUntil: string | null; // rule 4, "Queued until <time>", already formatted in the viewer's zone
  severity: Severity;
}

export interface WorklistData {
  main: MainRow[];
  contributing: ContributingRow[];
  reported: ReportedRow[];
  // PO decision: once an issue is Resolved, only its communicator still has
  // work to do (close with the customer) -- everyone else who'd otherwise
  // see it in `main` or `contributing` (owner, contributor; not a Compliance
  // assessor with a genuinely outstanding step, whose work isn't gated on
  // the Ops/CS resolution) sees it here instead: a collapsed group, not
  // counted in `count` or the summary strip/badge. Same MainRow shape so
  // the UI can reuse its row rendering.
  resolvedWaiting: MainRow[];
  count: number;
  badgeCount: number;
  badgeRed: boolean;
  /** The server demo clock at the moment of this load, and the viewer's zone: every time on the new rows is formatted from these, never from the browser's clock. */
  serverNow: string;
  viewerZone: string;
  // Brief 5.2 Components "Home link": the aria-label names the two counts
  // separately ("Home, 1 unacknowledged assignment, 2 issue steps"), even
  // though the visible pill shows their sum (badgeCount).
  unacknowledgedAssignments: number;
  issueStepCount: number;
}

/**
 * Home's "Your worklist is clear" card: only when there is nothing in Issues, Contributing, Reported by me or the
 * "Resolved, waiting for the customer" group. (It used to show for Network and Finance whatever the Issues section held.)
 */
export function isIssuesEmpty(data: Pick<WorklistData, "main" | "contributing" | "reported" | "resolvedWaiting">): boolean {
  return data.main.length === 0 && data.contributing.length === 0 && data.reported.length === 0 && data.resolvedWaiting.length === 0;
}

interface Viewer {
  id: string;
  name: string;
  team: Team;
  timeZone: string;
}

/** Every field stepsFor()/computeClocks()/effectiveCommunicator() need, for every issue not Closed. */
async function loadCandidateIssues() {
  const issues = await db.issue.findMany({
    // M27 AC6: a Closed issue stays in the owner's worklist while its root cause report is not recorded.
    where: { OR: [{ status: { not: "CLOSED" } }, { status: "CLOSED", rootCauseTask: { is: { sentAt: null } } }] },
    select: {
      id: true,
      number: true,
      type: true,
      description: true,
      scheme: true,
      country: true,
      status: true,
      severity: true,
      severityCapLabel: true,
      awareAt: true,
      clocksStartAt: true,
      ackStartAt: true,
      acknowledgedAt: true,
      notifyRequired: true,
      notifyStartAt: true,
      notifyTargetHours: true,
      notifyDefaultTarget: true,
      notifyTargetBusinessMins: true,
      notifiedAt: true,
      routingRule: true,
      ownerId: true,
      ownerTeam: true,
      owner: { select: { id: true, name: true, team: true, timeZone: true, active: true } },
      communicatorRule: true,
      handoverAt: true,
      complianceFlaggedAt: true,
      complianceClockStartAt: true,
      complianceClosedAt: true,
      complianceAssessorId: true,
      complianceVisibleFrom: true,
      reporterId: true,
      entity: {
        select: {
          id: true,
          legalName: true,
          country: true,
          deletedAt: true,
          ownerId: true,
          owner: { select: { id: true, name: true, team: true, timeZone: true, active: true } },
          issueTeam: { where: { team: "COMPLIANCE" }, select: { user: { select: { id: true, name: true, active: true } } } },
        },
      },
      assessments: { select: { assessedAt: true, assessedBy: { select: { name: true } } }, orderBy: { assessedAt: "asc" }, take: 1 },
      rootCauseTask: { select: { dueAt: true, sentAt: true, approvedAt: true, approvedBy: { select: { name: true, team: true } }, draftSharedAt: true, draftSharedBy: { select: { name: true } }, changesRequestedAt: true, changesRequestedBy: { select: { name: true } }, changesRequestReason: true } },
      acknowledgedBy: { select: { name: true } },
      complianceAssessor: { select: { id: true, name: true } },
      parentLinks: {
        where: { unlinkedAt: null },
        select: { parent: { select: { id: true, number: true, severity: true, ackStartAt: true, clocksStartAt: true, ownerTeam: true, owner: { select: { timeZone: true, team: true } }, acknowledgedAt: true, acknowledgedBy: { select: { name: true } }, entity: { select: { legalName: true } } } } },
      },
      contributors: { where: { removedAt: null }, select: { userId: true } },
      notes: { where: { kind: "ADDED_REPORT" }, select: { authorId: true } },
      communications: { where: { type: "CLOSURE_CONFIRMED" }, select: { occurredAt: true, recordedByName: true }, take: 1 },
    },
  });
  // Brief 4.6.9: run the hand-over (and other on-read) system writes for
  // every issue this query is about to show, so a due hand-over is
  // reflected in the same response, not only the next one.
  await Promise.all(issues.map((i) => ensureSystemWrites(i.id)));
  return issues.filter((i) => !i.entity.deletedAt); // M20 edge case 6
}

type CandidateIssue = Awaited<ReturnType<typeof loadCandidateIssues>>[number];

interface Enriched {
  issue: CandidateIssue;
  communicatorId: string | null;
  communicator: { id: string; name: string; team: CandidateIssue["ownerTeam"] } | null;
  clocks: ReturnType<typeof computeClocks>;
  schemeCountry: string | null;
  firstAssessmentAt: Date | null;
  /** The issue as the role-actions function reads it (viewer-independent). */
  actionIssue: RoleActionIssue;
}

function enrich(issue: CandidateIssue, viewerZone: string, now: Date): Enriched {
  const communicatorId = effectiveCommunicator(issue, { ownerId: issue.entity.ownerId }, now);
  const communicator = communicatorId === issue.ownerId ? issue.owner : communicatorId === issue.entity.ownerId ? issue.entity.owner : null;
  const ownerCalendar: Calendar | null = issue.owner ? teamCalendar(issue.ownerTeam, issue.owner) : issue.ownerId ? null : teamCalendar(issue.ownerTeam);
  const communicatorCalendar: Calendar | null = communicator ? userCalendar(communicator) : null;
  const firstAssessmentAt = issue.assessments[0]?.assessedAt ?? null;
  const clockFields: IssueClockFields = {
    severity: issue.severity,
    status: issue.status,
    severityCapLabel: issue.severityCapLabel,
    clocksStartAt: issue.clocksStartAt,
    ackStartAt: issue.ackStartAt,
    acknowledgedAt: issue.acknowledgedAt,
    notifyRequired: issue.notifyRequired,
    notifyStartAt: issue.notifyStartAt,
    notifyTargetHours: issue.notifyTargetHours,
    notifyDefaultTarget: issue.notifyDefaultTarget,
    notifyTargetBusinessMins: issue.notifyTargetBusinessMins,
    notifiedAt: issue.notifiedAt,
    complianceFlaggedAt: issue.complianceFlaggedAt,
    complianceClockStartAt: issue.complianceClockStartAt,
    firstAssessmentAt,
  };
  const clocks = computeClocks(clockFields, { ownerCalendar, communicatorCalendar, viewerZone }, now);
  const schemeCountry = issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme as Scheme]} / ${issue.country}` : null;
  const parent = issue.routingRule === "INHERITED_FROM_PARENT" ? (issue.parentLinks[0]?.parent ?? null) : null;
  const actionIssue: RoleActionIssue = {
    issueId: issue.id,
    number: issue.number,
    status: issue.status,
    severity: issue.severity,
    entityName: issue.entity.legalName,
    isPartnerIssue: issue.communicatorRule === "ISSUE_OWNER_PARTNER",
    owner: issue.owner ? { id: issue.owner.id, name: issue.owner.name } : null,
    communicator: communicator ? { id: communicator.id, name: communicator.name } : null,
    complianceAssessor: issue.complianceAssessor ? { id: issue.complianceAssessor.id, name: issue.complianceAssessor.name } : null,
    contributorIds: issue.contributors.map((c) => c.userId),
    clocksStartAt: issue.clocksStartAt,
    acknowledgedAt: issue.acknowledgedAt,
    acknowledgedByName: issue.acknowledgedBy?.name ?? null,
    notifyRequired: issue.notifyRequired,
    notifiedAt: issue.notifiedAt,
    notifiedByName: null,
    closure: issue.communications[0] ? { at: issue.communications[0].occurredAt, byName: issue.communications[0].recordedByName } : null,
    complianceFlaggedAt: issue.complianceFlaggedAt,
    complianceClosedAt: issue.complianceClosedAt,
    complianceVisibleFrom: issue.complianceVisibleFrom,
    firstAssessment: issue.assessments[0] ? { at: issue.assessments[0].assessedAt, byName: issue.assessments[0].assessedBy.name } : null,
    reportTask: issue.rootCauseTask
      ? {
          dueAt: issue.rootCauseTask.dueAt,
          sentAt: issue.rootCauseTask.sentAt,
          sentToName: null,
          sentByName: null,
          sentByTeam: null,
          reportUrl: null,
          approvedAt: issue.rootCauseTask.approvedAt,
          approvedByName: issue.rootCauseTask.approvedBy?.name ?? null,
          approvedByTeam: issue.rootCauseTask.approvedBy?.team ?? null,
          draftSharedAt: issue.rootCauseTask.draftSharedAt,
          draftSharedByName: issue.rootCauseTask.draftSharedBy?.name ?? null,
          changesRequest: issue.rootCauseTask.changesRequestedAt ? { byName: issue.rootCauseTask.changesRequestedBy?.name ?? null, reason: issue.rootCauseTask.changesRequestReason ?? "" } : null,
        }
      : null,
    reportReviewer: issue.entity.issueTeam[0]?.user.active ? { id: issue.entity.issueTeam[0].user.id, name: issue.entity.issueTeam[0].user.name } : null,
    inheritedFrom: parent
      ? { id: parent.id, number: parent.number, entityName: parent.entity.legalName, acknowledgedAt: parent.acknowledgedAt, acknowledgedByName: parent.acknowledgedBy?.name ?? null, ackDueAt: ackDueAtOf({ severity: parent.severity, ackStartAt: parent.ackStartAt, clocksStartAt: parent.clocksStartAt, ownerCalendar: teamCalendar(parent.ownerTeam, parent.owner) }) }
      : null,
    clocks,
  };
  return { issue, communicatorId, communicator, clocks, schemeCountry, firstAssessmentAt, actionIssue };
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** The new Home row for one viewer (Mine) or for the whole issue (My team). */
function buildView(e: Enriched, rav: RoleActionsView, scope: "mine" | "team"): { view: RowView; key: HomeSortKey } {
  const { issue } = e;
  const base = {
    scope,
    linkedTo: issue.parentLinks[0] ? issueDisplayId(issue.parentLinks[0].parent.number) : null,
    productLine: e.schemeCountry,
    statusNote: issue.status === "RESOLVED" || issue.status === "CLOSED" ? ISSUE_STATUS_LABELS[issue.status] : null,
    entityName: issue.entity.legalName,
    typeLabel: ISSUE_TYPE_LABELS[issue.type],
    descriptionLine: firstLine(issue.description),
    isPartner: issue.communicatorRule === "ISSUE_OWNER_PARTNER",
  };
  const line = (a: RoleActionsView["open"][number], forOthers = false): RoleLine => ({ role: a.role, person: a.person.name, label: forOthers ? (a.waitLabel ?? a.shortLabel) : a.shortLabel, dueAt: iso(a.dueAt) });
  const sortFields = { finished: issue.status === "RESOLVED" || issue.status === "CLOSED", severity: issue.severity, awareAt: issue.awareAt, number: issue.number };

  if (scope === "team") {
    const lead = rav.mostUrgent;
    return {
      view: {
        ...base,
        timeDueAt: iso(lead?.dueAt ?? null),
        timePerson: lead?.person.name ?? null,
        timeDateOnly: !!lead?.dateOnly,
        line1: lead ? { kind: "person", person: lead.person.name, label: lead.shortLabel } : { kind: "none" },
        line2: rav.open.filter((a) => a !== lead).map((a) => line(a)),
        hasAction: rav.open.length > 0,
      },
      key: { hasAction: rav.open.length > 0, dueAt: lead?.dueAt ?? null, ...sortFields },
    };
  }

  const own = rav.mine[0] ?? null;
  const waiting = rav.waitingOn;
  return {
    view: {
      ...base,
      timeDueAt: iso(own?.dueAt ?? null),
      timePerson: null,
      timeDateOnly: !!own?.dateOnly,
      line1: own
        ? { kind: "own", label: own.shortLabel }
        : waiting
          ? { kind: "waiting", role: waiting.role, person: waiting.person.name, label: waiting.waitLabel ?? waiting.shortLabel }
          : { kind: "none" },
      // The viewer's further own actions, then everyone else's, minus the one line 1 already names.
      line2: [...rav.mine.slice(1).map((a) => line(a)), ...rav.others.filter((a) => a !== waiting).map((a) => line(a, true))],
      hasAction: !!own,
    },
    key: { hasAction: !!own, dueAt: own?.dueAt ?? null, ...sortFields },
  };
}

type RowBody = Omit<MainRow, "dueAt" | "awareAt"> & { dueAt: Date | null; awareAt: Date };

interface MainRowInternal {
  row: RowBody;
  key: HomeSortKey;
  // PO decision: Resolved, and nobody's own outstanding step keeps it visible --
  // the communicator's "Close with the customer" and a Compliance assessor's
  // genuinely outstanding "Assess for Compliance" both keep a row in `main`
  // regardless of status.
  isResolvedWaiting: boolean;
}

/** One viewer's own main-list row for `e`, or null if they hold no main-list role on it (M20 AC2, AC8). */
function mainRowFor(e: Enriched, userId: string, now: Date, scope: "mine" | "team", personName?: string): MainRowInternal | null {
  const { issue } = e;
  const isOwner = issue.ownerId === userId;
  const isCommunicator = e.communicatorId === userId;
  const ruleFour = issue.routingRule === "QUEUED_FOR_BUSINESS_HOURS" && now < issue.clocksStartAt;
  const assessorEligible =
    issue.complianceAssessorId === userId &&
    !!issue.complianceFlaggedAt &&
    !e.firstAssessmentAt &&
    !issue.complianceClosedAt &&
    (!issue.complianceVisibleFrom || issue.complianceVisibleFrom <= now);

  // Compliance's review of the root cause report: open from the resolution until a Compliance user approves it.
  const task = issue.rootCauseTask;
  const reviewerEligible = e.actionIssue.reportReviewer?.id === userId && !!task && !task.approvedAt && !task.sentAt;

  if (ruleFour && (isOwner || isCommunicator) && !assessorEligible) return null; // M20 AC8
  if (!isOwner && !isCommunicator && !assessorEligible && !reviewerEligible) return null;

  // M27 AC6: the owner's unsent root cause report keeps the issue in their main list, Resolved or even Closed.
  const reportOpen = (isOwner && !!issue.rootCauseTask && !issue.rootCauseTask.sentAt) || reviewerEligible;
  if (issue.status === "CLOSED" && !reportOpen) return null; // a Closed issue is only here for that task

  const steps = stepsFor(
    {
      status: issue.status,
      notifyRequired: issue.notifyRequired,
      severity: issue.severity,
      notifiedAt: issue.notifiedAt,
      complianceFlaggedAt: issue.complianceFlaggedAt,
      complianceClosedAt: issue.complianceClosedAt,
      firstAssessmentAt: e.firstAssessmentAt,
      complianceVisibleFrom: issue.complianceVisibleFrom,
      resolutionConfirmed: issue.communications.length > 0,
      reportTask: issue.rootCauseTask ? { dueAt: issue.rootCauseTask.dueAt, sent: !!issue.rootCauseTask.sentAt, approved: !!issue.rootCauseTask.approvedAt, draftShared: !!issue.rootCauseTask.draftSharedAt } : null,
    },
    { isOwner, isCommunicator, isComplianceAssessor: assessorEligible, isReportReviewer: reviewerEligible },
    e.clocks,
    now,
  );
  const { step, moreCount } = leadingStep(steps);
  const { view, key } = buildView(e, roleActionsFor(e.actionIssue, userId, now), scope);
  // Resolved and nothing left for this viewer: a communicator who has confirmed the resolution waits like everyone else.
  const isResolvedWaiting = issue.status === "RESOLVED" && !assessorEligible && !reportOpen && (!isCommunicator || steps.length === 0);

  return {
    isResolvedWaiting,
    key,
    row: {
      issueId: issue.id,
      number: issue.number,
      typeLabel: ISSUE_TYPE_LABELS[issue.type],
      entityName: issue.entity.legalName,
      entityCountry: issue.entity.country,
      schemeCountry: e.schemeCountry,
      statusLabel: ISSUE_STATUS_LABELS[issue.status],
      roleLabel: roleLabel({ isOwner, isCommunicator, isComplianceAssessor: assessorEligible, isReportReviewer: reviewerEligible }),
      stepText: step?.text ?? null,
      stepClockText: step?.clockText ?? null,
      stepOverdue: step?.overdue ?? false,
      moreStepsCount: moreCount,
      dueAt: step?.dueAt ?? null,
      severity: issue.severity,
      awareAt: issue.awareAt,
      personName,
      view,
    },
  };
}

/** Legacy order (the leading step's deadline, then severity): what the Home badge reads. */
function sortMain(rows: RowBody[]): RowBody[] {
  return [...rows].sort(
    (a, b) =>
      Number(a.dueAt === null) - Number(b.dueAt === null) ||
      (a.dueAt && b.dueAt ? a.dueAt.getTime() - b.dueAt.getTime() : 0) ||
      Number(a.severity.slice(3)) - Number(b.severity.slice(3)) ||
      a.awareAt.getTime() - b.awareAt.getTime() ||
      a.number - b.number,
  );
}

function sortSecondary(rows: Enriched[]): Enriched[] {
  return [...rows].sort(
    (a, b) =>
      Number(a.issue.severity.slice(3)) - Number(b.issue.severity.slice(3)) ||
      a.issue.awareAt.getTime() - b.issue.awareAt.getTime() ||
      a.issue.number - b.issue.number,
  );
}

function serializeRow(r: RowBody): MainRow {
  return { ...r, dueAt: r.dueAt?.toISOString() ?? null, awareAt: r.awareAt.toISOString() };
}

/** Rows ordered by the Home rule, one per issue (the first wins when several team members hold a role on it). */
function sortRows(rows: MainRowInternal[]): RowBody[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((a, b) => compareHomeRows(a.key, b.key))
    .filter((r) => (seen.has(r.row.issueId) ? false : (seen.add(r.row.issueId), true)))
    .map((r) => r.row);
}

/** A pure contributor (no owner/communicator/assessor role) on a Resolved issue,
 * shaped as a MainRow so it can join the same `resolvedWaiting` group as everyone
 * else's rows there -- see WorklistData.resolvedWaiting. */
function resolvedWaitingRowForContributor(e: Enriched, viewerId: string, now: Date): MainRowInternal {
  const { issue } = e;
  const { view, key } = buildView(e, roleActionsFor(e.actionIssue, viewerId, now), "mine");
  return {
    isResolvedWaiting: true,
    key,
    row: {
      issueId: issue.id,
      number: issue.number,
      typeLabel: ISSUE_TYPE_LABELS[issue.type],
      entityName: issue.entity.legalName,
      entityCountry: issue.entity.country,
      schemeCountry: e.schemeCountry,
      statusLabel: ISSUE_STATUS_LABELS[issue.status],
      roleLabel: "Contributor",
      stepText: null,
      stepClockText: null,
      stepOverdue: false,
      moreStepsCount: 0,
      dueAt: null,
      severity: issue.severity,
      awareAt: issue.awareAt,
      view,
    },
  };
}

export async function loadWorklistIssues(viewer: Viewer, scope: "mine" | "team"): Promise<WorklistData> {
  const now = nowFn();
  const viewerZone = effectiveTimeZone(viewer);
  const candidates = await loadCandidateIssues();
  const enriched = candidates.map((i) => enrich(i, viewerZone, now));

  const teamEligible = scope === "team" && (viewer.team === "OPS" || viewer.team === "CS");
  const rowScope = teamEligible ? "team" : "mine";
  let mainAll: MainRowInternal[];
  if (teamEligible) {
    const teamUsers = await db.user.findMany({ where: { team: viewer.team, active: true }, select: { id: true, name: true } });
    mainAll = enriched.flatMap((e) => teamUsers.map((u) => mainRowFor(e, u.id, now, "team", u.name)).filter((r): r is MainRowInternal => !!r));
  } else {
    mainAll = enriched.map((e) => mainRowFor(e, viewer.id, now, "mine")).filter((r): r is MainRowInternal => !!r);
  }
  const main: MainRow[] = sortRows(mainAll.filter((r) => !r.isResolvedWaiting)).map(serializeRow);
  const resolvedWaitingFromMain = mainAll.filter((r) => r.isResolvedWaiting);

  // Contributing and Reported by me: "Mine" only (AC11), no role above (AC2) -- "above" means the viewer's OWN main list, regardless of scope.
  const mineMainIds = new Set(enriched.filter((e) => mainRowFor(e, viewer.id, now, "mine") !== null).map((e) => e.issue.id));

  const contributorCandidates = enriched.filter((e) => !mineMainIds.has(e.issue.id) && e.issue.contributors.some((c) => c.userId === viewer.id));
  // M27 AC4, AC6: a contributor with an action of their own (Compliance: "Review root cause report") stays under "Contributing" even when the
  // issue is Resolved; the report being recorded ends that action, and the issue then follows the usual rules (Resolved: the collapsed group).
  const viewsFor = new Map(contributorCandidates.map((e) => [e.issue.id, buildView(e, roleActionsFor(e.actionIssue, viewer.id, now), "mine").view]));
  const hasOwnAction = (e: Enriched) => viewsFor.get(e.issue.id)!.hasAction;
  const contributing: ContributingRow[] = sortSecondary(contributorCandidates.filter((e) => (e.issue.status !== "RESOLVED" && e.issue.status !== "CLOSED") || hasOwnAction(e)))
    .sort((a, b) => Number(hasOwnAction(b)) - Number(hasOwnAction(a)))
    .map((e) => ({
      issueId: e.issue.id,
      number: e.issue.number,
      entityName: e.issue.entity.legalName,
      statusLabel: ISSUE_STATUS_LABELS[e.issue.status],
      ownerLabel: e.issue.owner ? `Owner: ${e.issue.owner.name} (${TEAM_LABELS[e.issue.owner.team]})` : "Owner: unassigned",
      severity: e.issue.severity,
      view: viewsFor.get(e.issue.id)!,
    }));
  const resolvedWaitingFromContributing = contributorCandidates.filter((e) => e.issue.status === "RESOLVED" && !hasOwnAction(e)).map((e) => resolvedWaitingRowForContributor(e, viewer.id, now));

  const resolvedWaiting: MainRow[] = sortRows([...resolvedWaitingFromMain, ...resolvedWaitingFromContributing]).map(serializeRow);

  const reported: ReportedRow[] = sortSecondary(
    enriched.filter((e) => e.issue.status !== "CLOSED" && !mineMainIds.has(e.issue.id) && (e.issue.reporterId === viewer.id || e.issue.notes.some((n) => n.authorId === viewer.id))),
  ).map((e) => {
    const ruleFour = e.issue.routingRule === "QUEUED_FOR_BUSINESS_HOURS" && now < e.issue.clocksStartAt;
    return {
      issueId: e.issue.id,
      number: e.issue.number,
      entityName: e.issue.entity.legalName,
      statusLabel: ISSUE_STATUS_LABELS[e.issue.status],
      ownerLabel: e.issue.owner ? `${e.issue.owner.name} (${TEAM_LABELS[e.issue.owner.team]})` : "unassigned",
      communicatorLabel: e.communicator ? `${e.communicator.name} (${TEAM_LABELS[e.communicator.team]})` : "none",
      queuedUntil: ruleFour ? formatInZone(e.issue.clocksStartAt, viewerZone) : null,
      severity: e.issue.severity,
    };
  });

  // The Issues summary chip counts the rows of the Issues and Contributing groups: "Reported by me" is outside it.
  const count = main.length + contributing.length;

  // Badge (AC9): the viewer's own "Mine" main-list rows, regardless of the section's current scope toggle -- the badge is global navigation, not scoped to whatever the Home page happens to show right now.
  const mineMain =
    rowScope === "mine"
      ? sortMain(mainAll.filter((r) => !r.isResolvedWaiting).map((r) => r.row))
      : sortMain(enriched.map((e) => mainRowFor(e, viewer.id, now, "mine")).filter((r): r is MainRowInternal => !!r && !r.isResolvedWaiting).map((r) => r.row));
  const withStep = mineMain.filter((r) => r.stepText !== null);
  // Milestone 7, brief 4.6.9: "the Home navigation badge becomes the M9 count (4.5) plus the main-list rows with at least one step" -- added here (not a second polling target) per 6C's own DECISIONS.md note.
  const unacknowledgedAssignments = await db.ownerAssignment.count({
    where: { assigneeId: viewer.id, acknowledgedAt: null, supersededAt: null, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
  });
  const badgeCount = withStep.length + unacknowledgedAssignments;
  const badgeRed = withStep.some((r) => r.stepOverdue || (r.severity === "SEV1" && r.statusLabel === ISSUE_STATUS_LABELS.NEW));

  return {
    main,
    contributing,
    reported,
    resolvedWaiting,
    count,
    badgeCount,
    badgeRed,
    serverNow: now.toISOString(),
    viewerZone,
    unacknowledgedAssignments,
    issueStepCount: withStep.length,
  };
}
