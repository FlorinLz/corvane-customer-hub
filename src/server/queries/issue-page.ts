import { db } from "@/server/db";
import { now as nowFn } from "@/lib/dates";
import { teamCalendar, userCalendar, type Calendar } from "@/lib/business-hours";
import { effectiveTimeZone } from "@/lib/time-zones";
import { STAGE_ORDER } from "@/lib/labels";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { ackDueAtOf, computeClocks, type IssueClockFields } from "@/server/derived/issue-clocks";
import { computeDeadlines, deadlineFactsOf } from "@/server/derived/deadlines";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { roleActionsFor, type RoleActionIssue } from "@/server/derived/role-actions";
import { TYPE_SEVERITY_CAP } from "@/server/derived/severity";
import { buildStageMessage, selectStage } from "@/server/issues/stage-message";
import { type MessageContact } from "@/server/issues/message";
import { resolveDecidingStage } from "@/server/services/issue";
import { loadDegradedProposal, loadLinkedIssuesPanel, loadDualRoleBanner } from "@/server/queries/issue-partner-panels";
import { loadAffectedCustomers } from "@/server/queries/issue-affected-customers";
import type { User } from "@prisma/client";

// Brief 4.9.1, M17-M22. The Issue page's single data loader -- a server
// component calls this directly (this app's established no-GET-route
// convention), not `cache()`-wrapped: `ensureSystemWrites()` can write,
// and the page relies on a fresh read on every visit/refresh (router.refresh()).

const CONTACT_SELECT = {
  id: true,
  fullName: true,
  jobTitle: true,
  phone: true,
  email: true,
  timeZone: true,
  isPrimary: true,
  available24x7: true,
  availabilityDays: true,
  availabilityStart: true,
  availabilityEnd: true,
  status: true,
  role: true,
} as const;

export async function loadIssuePageData(issueId: string, viewer: User) {
  await ensureSystemWrites(issueId);

  const issue = await db.issue.findUnique({
    where: { id: issueId },
    include: {
      entity: {
        select: {
          id: true,
          legalName: true,
          country: true,
          deletedAt: true,
          ownerId: true,
          owner: { select: { id: true, name: true, team: true, timeZone: true, active: true } },
          customerRole: { select: { active: true } },
          partnerRole: { select: { active: true } },
          issueTeam: { where: { team: "COMPLIANCE" }, select: { user: { select: { id: true, name: true, active: true } } } },
        },
      },
      product: { select: { id: true, product: true, country: true, stage: true } },
      reporter: { select: { id: true, name: true, team: true } },
      owner: { select: { id: true, name: true, team: true, timeZone: true, active: true } },
      acknowledgedBy: { select: { name: true } },
      restoredBy: { select: { name: true } },
      rootCauseTask: { include: { sentBy: { select: { name: true, team: true } }, approvedBy: { select: { name: true, team: true } }, draftSharedBy: { select: { name: true } }, changesRequestedBy: { select: { name: true } } } },
      customerReporterContact: { select: { fullName: true, status: true } },
      resolutions: { orderBy: { resolvedAt: "desc" }, include: { resolvedBy: { select: { name: true } } } },
      timeCorrections: { orderBy: { correctedAt: "asc" }, include: { correctedBy: { select: { name: true } } } },
      contributors: { where: { removedAt: null }, orderBy: { addedAt: "asc" }, include: { user: { select: { id: true, name: true, team: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      communications: { orderBy: { occurredAt: "desc" }, include: { contact: { select: { fullName: true, status: true } } } },
      assessments: { orderBy: { assessedAt: "desc" }, include: { assessedBy: { select: { name: true } } } },
      complianceAssessor: { select: { id: true, name: true, team: true } },
      childLinks: { where: { unlinkedAt: null }, include: { child: { select: { id: true, number: true, entityId: true, severity: true, entity: { select: { legalName: true, deletedAt: true } } } } } },
      parentLinks: {
        where: { unlinkedAt: null },
        include: { parent: { select: { id: true, number: true, entityId: true, severity: true, ackStartAt: true, clocksStartAt: true, ownerTeam: true, owner: { select: { timeZone: true, team: true } }, acknowledgedAt: true, acknowledgedBy: { select: { name: true } }, entity: { select: { legalName: true, deletedAt: true } } } } },
      },
    },
  });
  if (!issue) return null;

  const isPartnerIssue = issue.communicatorRule === "ISSUE_OWNER_PARTNER";
  const contactContext = isPartnerIssue ? "PARTNER" : "CUSTOMER";

  const [card, partnerCard, contacts, ownerTeamCandidates] = await Promise.all([
    issue.entity.customerRole?.active
      ? db.obligationCard.findUnique({ where: { entityId_kind: { entityId: issue.entityId, kind: "CUSTOMER_AGREEMENT" } } })
      : Promise.resolve(null),
    // Brief M23 AC3, AC9: information only, shown on the partner issue itself.
    isPartnerIssue
      ? db.obligationCard.findUnique({ where: { entityId_kind: { entityId: issue.entityId, kind: "PARTNER_AGREEMENT" } }, select: { incidentNoticeHours: true } })
      : Promise.resolve(null),
    // All active contacts of the issue's role context, Incident contacts first (3.4.3): the record-communication/close dialogs' person picker.
    db.contact.findMany({
      where: { entityId: issue.entityId, status: "ACTIVE", context: contactContext },
      select: CONTACT_SELECT,
      orderBy: [{ isPrimary: "desc" }, { fullName: "asc" }],
    }),
    // Brief M21 AC8: the reassign dialog's picker, active users of the owner team only.
    db.user.findMany({ where: { team: issue.ownerTeam, active: true }, select: { id: true, name: true, team: true, timeZone: true }, orderBy: { name: "asc" } }),
  ]);
  // The header's incident-contact block and the message greeting (M7 AC9, 4.9.10): the primary active Incident contact.
  const incidentContact = contacts.find((c) => c.role === "INCIDENT" && c.isPrimary) ?? contacts.find((c) => c.role === "INCIDENT") ?? null;

  const t = nowFn();
  const communicatorId = effectiveCommunicator(issue, { ownerId: issue.entity.ownerId }, t);
  const communicator = communicatorId
    ? communicatorId === issue.ownerId
      ? issue.owner
      : communicatorId === issue.entity.ownerId
        ? issue.entity.owner
        : await db.user.findUnique({ where: { id: communicatorId }, select: { id: true, name: true, team: true, timeZone: true, active: true } })
    : null;

  const roles = {
    isOwner: issue.ownerId === viewer.id,
    isCommunicator: communicatorId === viewer.id,
    isReporter: issue.reporterId === viewer.id,
    isContributor: issue.contributors.some((c) => c.userId === viewer.id),
  };

  const ownerCalendar: Calendar | null = issue.owner ? teamCalendar(issue.ownerTeam, issue.owner) : issue.ownerId ? null : teamCalendar(issue.ownerTeam);
  const communicatorCalendar: Calendar | null = communicator ? userCalendar(communicator) : null;
  const viewerZone = effectiveTimeZone(viewer);

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
    firstAssessmentAt: issue.assessments.length > 0 ? issue.assessments[issue.assessments.length - 1].assessedAt : null,
  };
  const clocks = computeClocks(clockFields, { ownerCalendar, communicatorCalendar, viewerZone }, t);
  const deadlines = computeDeadlines(
    deadlineFactsOf({ issue, communications: issue.communications, assessments: issue.assessments, card }),
    { owner: ownerCalendar, communicator: communicatorCalendar },
    t,
  );
  const factsPack = [...issue.communications].reverse().find((c) => c.type === "FACTS_PACK_SENT") ?? null; // communications are newest first
  const firstReply = [...issue.communications].reverse().find((c) => c.type === "FIRST_NOTIFICATION" || c.type === "UPDATE") ?? null;

  // Role actions: who has to do what on this issue, by when, as this viewer sees it (replaces the Clocks card and the "Overdue by" banner).
  const parent = issue.routingRule === "INHERITED_FROM_PARENT" ? (issue.parentLinks[0]?.parent ?? null) : null;
  const firstAssessment = issue.assessments.length > 0 ? issue.assessments[issue.assessments.length - 1] : null; // assessments are newest first
  const firstNotification = [...issue.communications].reverse().find((c) => c.type === "FIRST_NOTIFICATION") ?? null; // communications are newest first
  const actionIssue: RoleActionIssue = {
    issueId: issue.id,
    number: issue.number,
    status: issue.status,
    severity: issue.severity,
    entityName: issue.entity.legalName,
    isPartnerIssue,
    owner: issue.owner ? { id: issue.owner.id, name: issue.owner.name } : null,
    communicator: communicator ? { id: communicator.id, name: communicator.name } : null,
    complianceAssessor: issue.complianceAssessor ? { id: issue.complianceAssessor.id, name: issue.complianceAssessor.name } : null,
    contributorIds: issue.contributors.map((c) => c.userId),
    clocksStartAt: issue.clocksStartAt,
    acknowledgedAt: issue.acknowledgedAt,
    acknowledgedByName: issue.acknowledgedBy?.name ?? null,
    notifyRequired: issue.notifyRequired,
    notifiedAt: issue.notifiedAt,
    notifiedByName: firstNotification?.recordedByName ?? null,
    notifyTargetHours: issue.notifyTargetHours,
    notifyDefaultTarget: issue.notifyDefaultTarget,
    notifyTargetBusinessMins: issue.notifyTargetBusinessMins,
    communicatorRule: issue.communicatorRule,
    handoverAt: issue.handoverAt,
    complianceFlaggedAt: issue.complianceFlaggedAt,
    complianceClosedAt: issue.complianceClosedAt,
    complianceVisibleFrom: issue.complianceVisibleFrom,
    firstAssessment: firstAssessment ? { at: firstAssessment.assessedAt, byName: firstAssessment.assessedBy.name } : null,
    resolved:
      issue.resolvedAt && issue.resolutions[0]
        ? {
            at: issue.resolvedAt,
            byId: issue.resolutions[0].resolvedById,
            byName: issue.resolutions[0].resolvedBy.name,
            // Resolved with its partner issue (the cascade): "Resolved via ISS-1045".
            viaNumber: issue.parentLinks.find((l) => l.parent.id === issue.resolutions[0].cascadedFromIssueId)?.parent.number ?? null,
          }
        : null,
    closure: (() => {
      const c = issue.communications.find((x) => x.type === "CLOSURE_CONFIRMED");
      return c ? { at: c.occurredAt, byName: c.recordedByName } : null;
    })(),
    deadlines,
    restored: issue.restoredAt ? { at: issue.restoredAt, byName: issue.restoredBy?.name ?? null, note: issue.restoreNote } : null,
    factsSent: factsPack ? { at: factsPack.occurredAt, byName: factsPack.recordedByName } : null,
    reply: firstReply ? { at: firstReply.occurredAt, byName: firstReply.recordedByName } : null,
    // The Action plan also lists the steps that wait for an earlier one (Home does not).
    planned: true,
    reportPlan:
      !isPartnerIssue &&
      issue.severity === "SEV1" &&
      !issue.rootCauseTask &&
      (issue.entity.customerRole?.active ?? false) &&
      card?.regulatoryRegime != null &&
      card.regulatoryRegime !== "NONE"
        ? { days: card.postIncidentReportDays ?? null }
        : null,
    reportTask: issue.rootCauseTask
      ? {
          reportDays: issue.rootCauseTask.reportDays,
          dueAt: issue.rootCauseTask.dueAt,
          sentAt: issue.rootCauseTask.sentAt,
          sentToName: issue.rootCauseTask.sentToName,
          sentByName: issue.rootCauseTask.sentBy?.name ?? null,
          sentByTeam: issue.rootCauseTask.sentBy?.team ?? null,
          reportUrl: issue.rootCauseTask.reportUrl,
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
  const roleActions = roleActionsFor(actionIssue, viewer.id, t);

  // Brief M19 AC13, 4.9.6 "nothing changes on open issues ... lets the owner raise severity": caps
  // are re-derived from the issue's CURRENT scheme/country/product line and stage, not frozen at report time.
  const decidingStage = await resolveDecidingStage(db, issue.entityId, issue.productId, issue.scheme, issue.country);
  const severityCaps = {
    preGoLive: !issue.possibleBreach && (issue.entity.customerRole?.active ?? false) && (decidingStage === null || STAGE_ORDER.indexOf(decidingStage) + 1 < 7),
    typeCapSev1: !issue.possibleBreach && !!TYPE_SEVERITY_CAP[issue.type],
  };

  // Brief 4.9.8, M23: the partner-issue panels, and the dual-role banner for a linked customer issue.
  const [degradedProposal, affectedCustomers, linkedIssuesPanel, dualRoleBanner] = await Promise.all([
    isPartnerIssue ? loadDegradedProposal(issue.entityId, issue.scheme, issue.country, issue.createdAt) : Promise.resolve(null),
    isPartnerIssue && issue.scheme && issue.country ? loadAffectedCustomers(issue.id, issue.scheme, issue.country, issue.severity, issue.awareAt) : Promise.resolve(null),
    isPartnerIssue ? loadLinkedIssuesPanel(issue.id, viewerZone) : Promise.resolve(null),
    !isPartnerIssue ? loadDualRoleBanner(issue.id, issue.entityId, viewerZone) : Promise.resolve(null),
  ]);

  return {
    issue,
    viewer,
    roles,
    communicator,
    clocks,
    deadlines,
    roleActions,
    clockFields,
    clocksCtx: { ownerCalendar, communicatorCalendar, viewerZone },
    serverNow: t,
    card,
    partnerCard,
    contacts,
    incidentContact,
    isPartnerIssue,
    contactContext,
    severityCaps,
    ownerTeamCandidates,
    degradedProposal,
    affectedCustomers,
    linkedIssuesPanel,
    dualRoleBanner,
  };
}

export type IssuePageData = NonNullable<Awaited<ReturnType<typeof loadIssuePageData>>>;

/** The message preview (4.9.10): built from an already-loaded page's data, for the server component to pass into the client Communication section. */
export function buildIssueMessage(data: IssuePageData) {
  const { issue } = data;
  const contact: MessageContact | null = data.incidentContact?.timeZone
    ? { name: data.incidentContact.fullName, email: data.incidentContact.email, timeZone: data.incidentContact.timeZone }
    : null;
  const task = issue.rootCauseTask;
  const isPartnerIssue = issue.communicatorRule === "ISSUE_OWNER_PARTNER";
  const stage = selectStage({
    status: issue.status,
    notified: !!issue.notifiedAt,
    isPartnerIssue,
    reportReadyToSend: !!task && !!task.approvedAt && !task.sentAt,
    viewerIsOwner: data.roles.isOwner,
  });
  const resolution = issue.resolutions[0] ?? null;
  const message = buildStageMessage(stage, {
    issue: { number: issue.number, type: issue.type, scheme: issue.scheme, country: issue.country, impact: issue.impact, status: issue.status, severity: issue.severity, awareAt: issue.awareAt, resolvedAt: issue.resolvedAt },
    entity: { legalName: issue.entity.legalName, country: issue.entity.country },
    contact,
    communicatorName: data.communicator?.name ?? "—",
    ownerName: issue.owner?.name ?? "—",
    isPartnerIssue,
    resolution: resolution ? { rootCause: resolution.rootCause, solution: resolution.solution } : null,
    report: task ? { dueAt: task.dueAt, draftSummary: task.draftSummary, draftLink: task.draftLink } : null,
    preparedAt: data.serverNow,
  });
  return { ...message, stage };
}
