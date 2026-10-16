import { randomUUID } from "node:crypto";
import type { IssueStatus, IssueType, Prisma, Scheme, Severity, Stage, Team } from "@prisma/client";

import { createFields, recordFieldsMany, updateFields } from "@/server/audit/record";
import { addHistoryMany } from "@/server/audit/history";
import { auditEnum } from "@/server/audit/format";
import { mutate, type AuditLogger } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { db } from "@/server/db";
import { now, today, toLocalDate } from "@/lib/dates";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { addBusinessMinutes, businessMinutesBetween, isInBusinessHours, teamCalendar, userCalendar } from "@/lib/business-hours";
import { effectiveTimeZone, formatInZone, zoneCity, formatDateTime } from "@/lib/time-zones";
import {
  STAGE_ORDER,
  SCHEME_LABELS,
  ISSUE_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  SEVERITY_LABELS,
  TEAM_LABELS,
  issueDisplayId,
} from "@/lib/labels";
import type {
  ReportIssueInput,
  ReportGroupIssueInput,
  ChangeSeverityInput,
  ChangeTypeInput,
  AddReportToExistingInput,
  EditDescriptionInput,
  AcknowledgeIssueInput,
  ChangeStatusInput,
  ResolveIssueInput,
  RestoreIssueInput,
  AddContributorInput,
  RemoveContributorInput,
  ReassignIssueInput,
  AddIssueNoteInput,
} from "@/lib/validation/issues";
import { proposeSeverity, severityRank, TYPE_SEVERITY_CAP } from "@/server/derived/severity";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { routeIssue, type RoutingEntity } from "@/server/issues/routing";
import { complianceReasons } from "@/server/issues/compliance";
import { ackStartFor, checkTimes, resolveNeedsEvent } from "@/server/issues/times";
import { chooseComplianceAssessor } from "@/server/issues/compliance-assessor";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { assertIsOwner, requireIssueEntity } from "@/server/issues/roles";
import { syncCreatedChildrenAcknowledged, syncCreatedChildrenOwner } from "@/server/services/issue-partner";
import { createReportTasksIfDue } from "@/server/services/root-cause-report";
import {
  ACK_TARGET,
  ISSUE_OPEN_FOR_SIMILAR,
  ISSUE_REASON_LENGTH,
  ISSUE_TYPE_ROUTING,
  NOTIFY_TARGET_SEV1_DEFAULT_HOURS,
  NOTIFY_TARGET_SEV2_BUSINESS_MINUTES,
} from "@/server/config";
import { ConflictError, IssueForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/** Most advanced stage among a set of (non-cancelled) product lines, by STAGE_ORDER. */
function mostAdvancedStage(stages: Stage[]): Stage | null {
  if (stages.length === 0) return null;
  return stages.reduce((best, s) => (STAGE_ORDER.indexOf(s) > STAGE_ORDER.indexOf(best) ? s : best));
}

/** Brief M17 AC3, M19 AC2-AC3. Exported: the Issue page's query loader reruns this to show the Change-severity dialog's current caps (4.9.6 "nothing changes on open issues ... lets the owner raise severity"). */
export async function resolveDecidingStage(
  tx: Prisma.TransactionClient,
  entityId: string,
  productId: string | null | undefined,
  scheme: Scheme | null | undefined,
  country: string | null | undefined,
): Promise<Stage | null> {
  if (productId) {
    const line = await tx.contractedProduct.findUnique({ where: { id: productId }, select: { stage: true } });
    return line?.stage ?? null;
  }
  const where: Prisma.ContractedProductWhereInput = { entityId, cancelledAt: null };
  if (scheme && country) {
    where.product = scheme;
    where.country = country;
  }
  const lines = await tx.contractedProduct.findMany({ where, select: { stage: true } });
  return mostAdvancedStage(lines.map((l) => l.stage));
}

/**
 * Brief M23 AC1. A "Partner degraded or unavailable" report is a
 * partner issue only when the entity has an active partner role with a
 * non-Retired coverage row matching the reported scheme and country;
 * otherwise the save is blocked. Any other type is never a partner
 * issue, even on a partner entity.
 */
async function validatePartnerIssue(tx: Prisma.TransactionClient, entityId: string, entityName: string, type: IssueType, scheme: Scheme | null | undefined, country: string | null | undefined): Promise<boolean> {
  if (type !== "PARTNER_DEGRADED") return false;
  const role = await tx.partnerRole.findUnique({ where: { entityId }, select: { active: true, coverage: { select: { scheme: true, country: true, statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } } } } } });
  const matching = role?.active ? role.coverage.find((c) => c.scheme === scheme && c.country === country) : undefined;
  const current = matching ? computeCoverageStatus(matching.statusChanges.map((c) => ({ ...c, effectiveDate: toLocalDate(c.effectiveDate) })), today()).current : null;
  if (!current || current.status === "RETIRED") {
    throw new ValidationError({ scheme: [`${entityName} has no coverage for ${scheme ? SCHEME_LABELS[scheme] : "?"} / ${country ?? "?"}`] });
  }
  return true;
}

async function routingEntityOf(tx: Prisma.TransactionClient, entityId: string): Promise<RoutingEntity & { customerRoleActive: boolean }> {
  const entity = await tx.entity.findUniqueOrThrow({
    where: { id: entityId },
    include: { owner: { select: { id: true, timeZone: true, team: true } }, customerRole: { select: { active: true } } },
  });
  return {
    id: entity.id,
    legalName: entity.legalName,
    ownerId: entity.ownerId,
    owner: entity.owner,
    customerRoleActive: entity.customerRole?.active ?? false,
  };
}

async function createOneIssue(tx: Prisma.TransactionClient, log: AuditLogger, user: SessionUser, entityId: string, input: ReportIssueInput, groupReportId: string | null = null) {
  const entity = await routingEntityOf(tx, entityId);
  const decidingStage = await resolveDecidingStage(tx, entityId, input.productId, input.scheme, input.country);
  const proposal = proposeSeverity({
    impact: input.impact,
    possibleBreach: input.possibleBreach,
    type: input.type,
    decidingStage,
    customerRole: entity.customerRoleActive,
    scheme: input.scheme,
    country: input.country,
  });

  const isPartnerIssue = await validatePartnerIssue(tx, entityId, entity.legalName, input.type, input.scheme, input.country);
  const t = now();
  const routing = await routeIssue(tx, { type: input.type, severity: proposal.severity, entity, isPartnerIssue }, t);

  const customerReporterKind = input.customerReporter.kind;
  const customerReporterContactId = customerReporterKind === "CONTACT" ? input.customerReporter.contactId : null;
  let customerReporterName: string | null = null;
  if (customerReporterKind === "SOMEONE_ELSE") customerReporterName = input.customerReporter.name;
  else if (customerReporterKind === "CONTACT") {
    const contact = await tx.contact.findUnique({ where: { id: customerReporterContactId! }, select: { fullName: true } });
    customerReporterName = contact?.fullName ?? null;
  }

  const card = entity.customerRoleActive && !isPartnerIssue
    ? await tx.obligationCard.findUnique({ where: { entityId_kind: { entityId, kind: "CUSTOMER_AGREEMENT" } }, select: { regulatoryRegime: true, incidentNoticeHours: true } })
    : null;
  const reasons = complianceReasons({ possibleBreach: input.possibleBreach, type: input.type, severity: proposal.severity }, card, isPartnerIssue);
  const complianceFlaggedAt = reasons.length > 0 ? t : null;
  const complianceClockStartAt = reasons.length > 0 && proposal.severity === "SEV1" ? t : null;
  const assessor = reasons.length > 0 ? await chooseComplianceAssessor(tx, entityId, proposal.severity, t) : null;

  // Brief 4.9.8: a partner issue reads no customer card, so it has no
  // notification clock at all -- the Partner agreement's own notice
  // time is shown as information only, never a real deadline.
  const notifyRequired = !isPartnerIssue && (proposal.severity === "SEV1" || proposal.severity === "SEV2") && !proposal.capLabel?.includes("before go-live");
  const notifyTargetHours = notifyRequired && proposal.severity === "SEV1" ? card?.incidentNoticeHours ?? null : null;
  const notifyDefaultTarget = notifyRequired && proposal.severity === "SEV1" && notifyTargetHours === null;
  const notifyTargetBusinessMins = notifyRequired && proposal.severity === "SEV2" ? 240 : null;

  const issue = await tx.issue.create({
    data: {
      entityId,
      productId: input.productId ?? null,
      scheme: input.scheme ?? null,
      country: input.country ?? null,
      type: input.type,
      impact: input.impact,
      possibleBreach: input.possibleBreach,
      proposedSeverity: proposal.severity,
      severity: proposal.severity,
      severityCapLabel: proposal.capLabel,
      stageAtReport: decidingStage,
      description: input.description,
      awareAt: new Date(input.awareAt),
      eventAt: input.eventAt ? new Date(input.eventAt) : null,
      awarenessSource: input.awarenessSource,
      reporterKind: "USER",
      reporterId: user.id,
      reporterTeam: user.team,
      customerReporterKind,
      customerReporterContactId,
      customerReporterName,
      status: "NEW",
      ownerTeam: routing.ownerTeam,
      ownerId: routing.ownerId,
      ownerSince: routing.ownerId ? t : null,
      routingRule: routing.rule,
      routingReason: routing.routingReason,
      communicatorRule: routing.communicatorRule,
      handoverAt: routing.handoverAt,
      clocksStartAt: routing.clocksStartAt,
      ackStartAt: routing.ack ? ackStartFor(new Date(input.awareAt), routing.clocksStartAt, t) : null,
      notifyRequired,
      notifyStartAt: notifyRequired ? input.awareAt : null,
      notifyTargetHours,
      notifyDefaultTarget,
      notifyTargetBusinessMins,
      complianceFlaggedAt,
      complianceReasons: reasons,
      complianceClockStartAt,
      complianceAssessorId: assessor?.assessorId ?? null,
      complianceVisibleFrom: assessor?.visibleFrom ?? null,
      groupReportId,
      createdAt: t,
    },
  });

  // Brief M18 AC8: the entity's named person in the type's contributor
  // team is added on save (not just on a later type change) -- never from
  // on-call, and only when a named person exists.
  const contributorTeam = ISSUE_TYPE_ROUTING[input.type].contributor;
  let contributorUser: { id: string; name: string; team: Team } | null = null;
  if (contributorTeam) {
    const named = await tx.issueTeamMember.findUnique({
      where: { entityId_team: { entityId, team: contributorTeam } },
      include: { user: { select: { id: true, name: true, team: true } } },
    });
    if (named) {
      await tx.issueContributor.create({ data: { issueId: issue.id, userId: named.userId, isDefault: true, addedAt: t } });
      contributorUser = named.user;
    }
  }

  // Brief M18 AC11: the routing audit entry names owner, communicator,
  // contributors and the rule applied.
  const communicatorId = effectiveCommunicator(
    { communicatorRule: routing.communicatorRule, ownerId: routing.ownerId, handoverAt: routing.handoverAt },
    { ownerId: entity.ownerId },
    t,
  );
  const routedUserIds = [routing.ownerId, communicatorId].filter((id): id is string => id !== null);
  const routedUsers = routedUserIds.length > 0 ? await tx.user.findMany({ where: { id: { in: routedUserIds } }, select: { id: true, name: true, team: true } }) : [];
  const routedUserById = new Map(routedUsers.map((u) => [u.id, u]));
  const ownerUser = routing.ownerId ? routedUserById.get(routing.ownerId) : undefined;
  const communicatorUser = communicatorId ? routedUserById.get(communicatorId) : undefined;
  const routingSummary = [
    `Owner: ${ownerUser ? `${ownerUser.name} (${TEAM_LABELS[ownerUser.team]})` : `assigned at the start of ${TEAM_LABELS[routing.ownerTeam]} business hours`}`,
    `Communicator: ${communicatorUser ? `${communicatorUser.name} (${TEAM_LABELS[communicatorUser.team]})` : "none"}`,
    `Contributors: ${contributorUser ? `${contributorUser.name} (${TEAM_LABELS[contributorUser.team]})` : "none"}`,
    `Rule: ${routing.rule}`,
    `Time: ${t.toISOString()}`,
  ].join(". ");

  const schemeCountry = input.scheme && input.country ? `, ${SCHEME_LABELS[input.scheme]} ${input.country}` : "";
  await log.change({
    objectType: "ISSUE",
    objectId: issue.id,
    objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
    fields: createFields({
      Type: ISSUE_TYPE_LABELS[input.type],
      Severity: auditEnum(proposal.severity, { SEV1: "Sev-1", SEV2: "Sev-2", SEV3: "Sev-3", SEV4: "Sev-4" }),
      Description: input.description,
      Routing: routingSummary,
    }),
  });
  // Two History events (reported; and, per brief M18 AC11, routing's own, separate from "reported"), in one insert.
  await log.histories([
    {
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Issue ${issueDisplayId(issue.number)} reported by ${user.name} (${TEAM_LABELS[user.team]}): ${auditEnum(proposal.severity, { SEV1: "Sev-1", SEV2: "Sev-2", SEV3: "Sev-3", SEV4: "Sev-4" })}, ${ISSUE_TYPE_LABELS[input.type]}${schemeCountry}`,
    },
    {
      category: "INCIDENT",
      issueId: issue.id,
      summary: ownerUser
        ? `${issueDisplayId(issue.number)} routed to ${ownerUser.name} (${TEAM_LABELS[ownerUser.team]}), communicator ${communicatorUser ? `${communicatorUser.name} (${TEAM_LABELS[communicatorUser.team]})` : "none"}`
        : `${issueDisplayId(issue.number)} routed: queued for the start of ${TEAM_LABELS[routing.ownerTeam]} business hours`,
    },
  ]);

  return issue;
}

/** Times rule 1 (src/server/issues/times.ts): Event <= Corvane aware at <= Opened (= now when reporting) <= now. */
function assertReportTimes(input: { awareAt: string; eventAt?: string | null }) {
  const errors = checkTimes({ eventAt: input.eventAt ? new Date(input.eventAt) : null, awareAt: new Date(input.awareAt), now: now() });
  const fieldErrors = Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]]));
  if (Object.keys(fieldErrors).length > 0) throw new ValidationError(fieldErrors);
}

/** Brief 3.8.3, M17. Any active user of the 6 teams. */
export async function createIssue(user: SessionUser, entityId: string, input: ReportIssueInput) {
  assertCan(user, "issue.report");

  assertReportTimes(input);

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    return createOneIssue(tx, log, user, entityId, input);
  });
}

/** Brief M17 AC4, 4.9.2 rule 8. One issue per ticked entity, each routed independently, all in one transaction, sharing one IssueGroupReport. */
export async function createGroupIssues(user: SessionUser, groupId: string, input: ReportGroupIssueInput) {
  assertCan(user, "issue.report");
  const { entityIds, report } = input;

  assertReportTimes(report);

  return mutate(user, { entityId: null, groupId }, async (tx, log) => {
    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError();

    const members = await tx.entity.findMany({ where: { id: { in: entityIds }, groupId, deletedAt: null }, select: { id: true } });
    if (members.length === 0) throw new ValidationError({ entityIds: ["Select at least one affected entity"] });

    const groupReport = await tx.issueGroupReport.create({ data: { groupId, createdById: user.id } });

    const issues = [];
    for (const member of members) {
      // The group report id goes in with the insert: a separate update per member was one more round trip each.
      issues.push(await createOneIssue(tx, log, user, member.id, report, groupReport.id));
    }
    return issues;
  });
}

/**
 * Brief 3.8.x "Change severity"/"Change type": "Compliance flag re-evaluated" (M25 AC2).
 * Only ever sets the flag, never clears it (M25 edge case 3, "flag kept when severity drops").
 */
async function reevaluateComplianceFlag(
  tx: Prisma.TransactionClient,
  issue: { id: string; entityId: string; type: string; possibleBreach: boolean; complianceFlaggedAt: Date | null },
  newType: string,
  newSeverity: Severity,
): Promise<Partial<Prisma.IssueUncheckedUpdateInput>> {
  if (issue.complianceFlaggedAt) return {};
  const card = await tx.obligationCard.findUnique({
    where: { entityId_kind: { entityId: issue.entityId, kind: "CUSTOMER_AGREEMENT" } },
    select: { regulatoryRegime: true },
  });
  const reasons = complianceReasons({ possibleBreach: issue.possibleBreach, type: newType as IssueType, severity: newSeverity }, card, false);
  if (reasons.length === 0) return {};
  const t = now();
  const assessor = await chooseComplianceAssessor(tx, issue.entityId, newSeverity, t);
  return {
    complianceFlaggedAt: t,
    complianceReasons: reasons,
    complianceClockStartAt: newSeverity === "SEV1" ? t : null,
    complianceAssessorId: assessor.assessorId,
    complianceVisibleFrom: assessor.visibleFrom,
  };
}

/** Brief M19 AC13-AC15, AC19, AC20. */
export async function changeSeverity(user: SessionUser, issueId: string, input: ChangeSeverityInput) {
  assertCan(user, "issue.owner");

  const entityId = (await db.issue.findUnique({ where: { id: issueId }, select: { entityId: true } }))?.entityId ?? null;
  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (input.severity === issue.severity) {
      throw new ValidationError({ severity: ["Select a different severity"] });
    }

    const raised = severityRank(input.severity) < severityRank(issue.severity);
    const data: Prisma.IssueUncheckedUpdateInput = { severity: input.severity };

    if (raised) {
      if (issue.notifiedAt) {
        data.severityRaisedAfterNotice = true; // M19 edge case 1: the notification clock stays stopped with its recorded result
      } else {
        const notifyRequired = (input.severity === "SEV1" || input.severity === "SEV2") && !issue.severityCapLabel?.includes("before go-live");
        data.notifyRequired = notifyRequired;
        if (!notifyRequired) {
          data.notifyTargetHours = null;
          data.notifyTargetBusinessMins = null;
          data.notifyDefaultTarget = false;
          data.notifyDueAt = null;
        } else {
          data.notifyStartAt = issue.notifyStartAt ?? issue.awareAt;
          if (input.severity === "SEV1") {
            const card = await tx.obligationCard.findUnique({
              where: { entityId_kind: { entityId: issue.entityId, kind: "CUSTOMER_AGREEMENT" } },
              select: { incidentNoticeHours: true },
            });
            const targetHours = card?.incidentNoticeHours ?? NOTIFY_TARGET_SEV1_DEFAULT_HOURS;
            data.notifyTargetHours = targetHours;
            data.notifyDefaultTarget = card?.incidentNoticeHours == null;
            data.notifyTargetBusinessMins = null;
            data.notifyDueAt = new Date(issue.awareAt.getTime() + targetHours * 3_600_000);
          } else {
            const entity = await tx.entity.findUniqueOrThrow({ where: { id: issue.entityId }, include: { owner: { select: { id: true, timeZone: true, team: true } } } });
            const communicatorId = effectiveCommunicator(
              { communicatorRule: issue.communicatorRule, ownerId: issue.ownerId, handoverAt: issue.handoverAt },
              { ownerId: entity.ownerId },
              now(),
            );
            const communicator = communicatorId ? await tx.user.findUnique({ where: { id: communicatorId }, select: { timeZone: true, team: true } }) : null;
            data.notifyTargetHours = null;
            data.notifyDefaultTarget = false;
            data.notifyTargetBusinessMins = NOTIFY_TARGET_SEV2_BUSINESS_MINUTES;
            const communicatorCal = communicator ? userCalendar(communicator) : teamCalendar(issue.ownerTeam);
            data.notifyDueAt = addBusinessMinutes(issue.notifyStartAt ?? issue.awareAt, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES, communicatorCal);
          }
        }
      }

      if (!issue.acknowledgedAt) {
        const owner = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
        const ackTarget = ACK_TARGET[input.severity];
        const start = issue.ackStartAt ?? issue.clocksStartAt;
        const ownerCal = owner ? teamCalendar(issue.ownerTeam, owner) : teamCalendar(issue.ownerTeam);
        data.ackDueAt = ackTarget.business ? addBusinessMinutes(start, ackTarget.minutes, ownerCal) : new Date(start.getTime() + ackTarget.minutes * 60_000);
      }
    }
    // Lowered (AC15): save only the severity and reason -- every clock already started keeps its target and due time.

    Object.assign(data, await reevaluateComplianceFlag(tx, issue, issue.type, input.severity));

    const updated = await tx.issue.update({ where: { id: issue.id }, data: { ...data, version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: "Severity", oldValue: SEVERITY_LABELS[issue.severity], newValue: SEVERITY_LABELS[input.severity] }],
      reason: input.reason,
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} severity changed from ${SEVERITY_LABELS[issue.severity]} to ${SEVERITY_LABELS[input.severity]} by ${user.name}: ${input.reason}`,
    });

    // Brief M23 edge case 2: children keep their own severity -- this is purely informational.
    const activeChildren = await tx.issueLink.findMany({
      where: { parentId: issue.id, unlinkedAt: null, child: { severity: { not: input.severity } } },
      select: { child: { select: { id: true, number: true, severity: true } } },
    });
    const reviewSeverityNote =
      activeChildren.length > 0
        ? `${activeChildren.length} linked issue${activeChildren.length === 1 ? " is" : "s are"} ${SEVERITY_LABELS[activeChildren[0].child.severity]}. Review their severity.`
        : null;

    return { ...updated, reviewSeverityNote, linkedIssues: activeChildren.map((c) => ({ id: c.child.id, number: c.child.number })) };
  });
}

/** Brief M19 AC17-AC20. Re-runs routing (owner rules 2-4) for the new type; the notification clock keeps its start and target. */
export async function changeType(user: SessionUser, issueId: string, input: ChangeTypeInput) {
  assertCan(user, "issue.owner");

  const entityId = (await db.issue.findUnique({ where: { id: issueId }, select: { entityId: true } }))?.entityId ?? null;
  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (input.type === issue.type) {
      throw new ValidationError({ type: ["Select a different type"] });
    }

    // AC18: the new type's cap can only lower an already-stored severity (never raise one back up).
    let severity = issue.severity;
    let severityCapLabel = issue.severityCapLabel;
    const typeCap = TYPE_SEVERITY_CAP[input.type];
    if (!issue.possibleBreach && typeCap && severityRank(severity) < severityRank(typeCap)) {
      severity = typeCap;
      severityCapLabel = "Highest severity for this type: Sev-2";
    }

    const entity: RoutingEntity = await tx.entity.findUniqueOrThrow({
      where: { id: issue.entityId },
      select: { id: true, legalName: true, ownerId: true, owner: { select: { id: true, timeZone: true, team: true } } },
    });
    const routing = await routeIssue(tx, { type: input.type, severity, entity }, now());
    const ackStart = ackStartFor(issue.awareAt, routing.clocksStartAt, now());

    const data: Prisma.IssueUncheckedUpdateInput = {
      type: input.type,
      severity,
      severityCapLabel,
      status: "NEW",
      ownerTeam: routing.ownerTeam,
      ownerId: routing.ownerId,
      ownerSince: routing.ownerId ? now() : null,
      routingRule: routing.rule,
      routingReason: routing.routingReason,
      communicatorRule: routing.communicatorRule,
      handoverAt: routing.handoverAt,
      clocksStartAt: routing.clocksStartAt,
      ackStartAt: routing.ack ? ackStart : null,
      acknowledgedAt: null,
      acknowledgedById: null,
      ackDueAt: null,
      // notify clock: unchanged (AC17 "keeps its start and target").
    };

    if (routing.ack) {
      const ackTarget = ACK_TARGET[severity];
      const ackCal = routing.ownerId ? teamCalendar(routing.ownerTeam, await tx.user.findUnique({ where: { id: routing.ownerId }, select: { timeZone: true, team: true } })) : teamCalendar(routing.ownerTeam);
      data.ackDueAt = ackTarget.business
        ? addBusinessMinutes(ackStart, ackTarget.minutes, ackCal)
        : new Date(ackStart.getTime() + ackTarget.minutes * 60_000);
    }

    const contributorTeam = ISSUE_TYPE_ROUTING[input.type].contributor;
    if (contributorTeam) {
      const named = await tx.issueTeamMember.findUnique({ where: { entityId_team: { entityId: issue.entityId, team: contributorTeam } } });
      if (named) {
        // Never again someone who is on the issue or was taken off it by hand: a removal sticks.
        const existing = await tx.issueContributor.findFirst({ where: { issueId: issue.id, userId: named.userId } });
        if (!existing) {
          await tx.issueContributor.create({ data: { issueId: issue.id, userId: named.userId, isDefault: true, addedAt: now() } });
        }
      }
    }

    Object.assign(data, await reevaluateComplianceFlag(tx, issue, input.type, severity));

    const updated = await tx.issue.update({ where: { id: issue.id }, data: { ...data, version: { increment: 1 } } });

    const fields = [{ field: "Type", oldValue: ISSUE_TYPE_LABELS[issue.type], newValue: ISSUE_TYPE_LABELS[input.type] }];
    if (severity !== issue.severity) {
      fields.push({ field: "Severity", oldValue: SEVERITY_LABELS[issue.severity], newValue: SEVERITY_LABELS[severity] });
    }
    await log.change({ objectType: "ISSUE", objectId: issue.id, objectLabel: `Issue: ${issueDisplayId(issue.number)}`, fields, reason: input.reason });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} type changed from ${ISSUE_TYPE_LABELS[issue.type]} to ${ISSUE_TYPE_LABELS[input.type]} by ${user.name}: ${input.reason}`,
    });
    if (routing.ownerId && routing.ownerId !== issue.ownerId) {
      const newOwner = await tx.user.findUnique({ where: { id: routing.ownerId }, select: { name: true } });
      if (newOwner) await syncCreatedChildrenOwner(tx, issue.id, routing.ownerId, newOwner.name, user);
    }

    return updated;
  });
}

// ───────────── 6B: owner actions (M21) ─────────────

/** Brief M17 AC6, edge case 8. Any active user; the target's owner and severity never change. */
export async function addReportToExistingIssue(user: SessionUser, issueId: string, input: AddReportToExistingInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.report");
  assertReportTimes(input);
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (!ISSUE_OPEN_FOR_SIMILAR.includes(issue.status)) {
      throw new ValidationError({ issueId: [`${issueDisplayId(issue.number)} is no longer open. Report a new issue instead.`] });
    }

    const entity = await routingEntityOf(tx, issue.entityId);
    const decidingStage = await resolveDecidingStage(tx, issue.entityId, input.productId, input.scheme, input.country);
    const proposal = proposeSeverity({
      impact: input.impact,
      possibleBreach: input.possibleBreach,
      type: issue.type,
      decidingStage,
      customerRole: entity.customerRoleActive,
      scheme: input.scheme,
      country: input.country,
    });
    const suggestsHigher = severityRank(proposal.severity) < severityRank(issue.severity);

    let customerReporterName: string | null = null;
    if (input.customerReporter.kind === "SOMEONE_ELSE") customerReporterName = input.customerReporter.name;
    else if (input.customerReporter.kind === "CONTACT") {
      const contact = await tx.contact.findUnique({ where: { id: input.customerReporter.contactId }, select: { fullName: true } });
      customerReporterName = contact?.fullName ?? null;
    }

    const reportedBy = `${user.name} (${TEAM_LABELS[user.team]})`;
    const body = `Also reported by ${reportedBy}${suggestsHigher ? `. Reported impact suggests ${SEVERITY_LABELS[proposal.severity]}` : ""}`;
    const details = {
      description: input.description,
      awareAt: input.awareAt,
      reportedBy,
      impact: input.impact,
      possibleBreach: input.possibleBreach,
      customerReporterName,
      suggestsSeverity: suggestsHigher ? proposal.severity : null,
    };

    await tx.issueNote.create({
      data: { issueId: issue.id, kind: "ADDED_REPORT", body, details, authorId: user.id, authorName: user.name, authorTeam: user.team, createdAt: now() },
    });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ "Added report": body }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `Report added to ${issueDisplayId(issue.number)} by ${reportedBy}`,
    });

    return issue;
  });
}

/** Brief M17 AC11, AC13. Reporter only, while New. */
export async function editIssueDescription(user: SessionUser, issueId: string, input: EditDescriptionInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.report");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    if (issue.reporterId !== user.id) {
      throw new IssueForbiddenError("not_reporter", "Only the reporter can edit the description");
    }
    if (issue.status !== "NEW") {
      throw new IssueForbiddenError("not_reporter", "The description can be edited only before acknowledgement");
    }

    const updated = await tx.issue.update({ where: { id: issue.id }, data: { description: input.description, version: { increment: 1 } } });
    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: updateFields({ Description: issue.description }, { Description: input.description }),
    });
    return updated;
  });
}

/** Brief M21 AC1, M23 AC7 (the CREATED-linked-issue sync is 6C scope). */
export async function acknowledgeIssue(user: SessionUser, issueId: string, input: AcknowledgeIssueInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (issue.status !== "NEW") {
      throw new ValidationError({ status: ["This issue is already acknowledged"] });
    }

    const t = now();
    const updated = await tx.issue.update({
      where: { id: issue.id },
      data: { status: "IN_PROGRESS", acknowledgedAt: t, acknowledgedById: user.id, version: { increment: 1 } },
    });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [
        { field: "Status", oldValue: ISSUE_STATUS_LABELS.NEW, newValue: ISSUE_STATUS_LABELS.IN_PROGRESS },
        { field: "Acknowledged", oldValue: null, newValue: `${user.name} at ${formatDateTime(t)}` },
      ],
    });
    await log.history({ category: "INCIDENT", issueId: issue.id, summary: `${issueDisplayId(issue.number)} acknowledged by ${user.name}` });
    await syncCreatedChildrenAcknowledged(tx, issue.id, issue.number);

    return updated;
  });
}

/**
 * Closes the Waiting on customer pause of an issue that is leaving that status (or being resolved): the minutes it lasted, in wall minutes and in the
 * owner's business minutes, are kept on the issue so Restore, Resolve and Reply to customer resume where they stopped (derived/deadlines.ts).
 * Entering the status stamps `waitingOnCustomerSince`.
 */
async function pauseData(tx: Prisma.TransactionClient, issue: { status: IssueStatus; ownerId: string | null; ownerTeam: Team; waitingOnCustomerSince: Date | null; pausedMinutes: number; pausedBusinessMinutes: number }, to: IssueStatus, t: Date) {
  if (to === "WAITING_ON_CUSTOMER" && issue.status !== "WAITING_ON_CUSTOMER") return { waitingOnCustomerSince: t };
  if (issue.status === "WAITING_ON_CUSTOMER" && to !== "WAITING_ON_CUSTOMER") {
    const since = issue.waitingOnCustomerSince;
    if (!since) return { waitingOnCustomerSince: null };
    const owner = issue.ownerId ? await tx.user.findUnique({ where: { id: issue.ownerId }, select: { timeZone: true, team: true } }) : null;
    const cal = owner ? teamCalendar(issue.ownerTeam, owner) : teamCalendar(issue.ownerTeam);
    const wall = Math.max(0, Math.round((t.getTime() - since.getTime()) / 60_000));
    const business = Math.round(businessMinutesBetween(since, t, cal));
    return { waitingOnCustomerSince: null, pausedMinutes: issue.pausedMinutes + wall, pausedBusinessMinutes: issue.pausedBusinessMinutes + business };
  }
  return {};
}

/**
 * Service restored: the owner records when the service was back and a short note. It stops the Restore clock and moves the update cadence of a Sev-1
 * from 60 min to 4 h. Resolve stays a separate step (and resolving an issue that was never marked restored counts as restoring it).
 */
export async function recordServiceRestored(user: SessionUser, issueId: string, input: RestoreIssueInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (issue.status === "NEW") throw new ValidationError({ status: ["Acknowledge the issue first"] });
    if (issue.status === "RESOLVED" || issue.status === "CLOSED") throw new ValidationError({ status: ["This issue is already resolved"] });
    if (issue.restoredAt) throw new ValidationError({ status: ["The service is already recorded as restored"] });

    const restoredAt = new Date(input.restoredAt);
    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    if (restoredAt > now()) throw new ValidationError({ restoredAt: ["The time can't be in the future"] });
    if (restoredAt < issue.awareAt) throw new ValidationError({ restoredAt: [`The time can't be before Corvane aware at (${formatInZone(issue.awareAt, zone)})`] });

    const note = input.note?.trim() ? input.note.trim() : null;
    const updated = await tx.issue.update({ where: { id: issue.id }, data: { restoredAt, restoredById: user.id, restoreNote: note, version: { increment: 1 } } });
    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: "Service restored", oldValue: null, newValue: `${formatInZone(restoredAt, zone)}${note ? `: ${note}` : ""}` }],
    });
    await log.history({ category: "INCIDENT", issueId: issue.id, summary: `${issueDisplayId(issue.number)} service restored at ${formatInZone(restoredAt, zone)}, recorded by ${user.name}` });
    return updated;
  });
}

/** Brief M21 AC3, AC5. "Resolved" is handled by resolveIssue() -- never a target `status` here. */
export async function changeIssueStatus(user: SessionUser, issueId: string, input: ChangeStatusInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (issue.status === "NEW") {
      throw new ValidationError({ status: ["Acknowledge the issue first"] });
    }
    if (issue.status === "CLOSED") {
      throw new ValidationError({ status: ["This issue is closed"] });
    }
    if (issue.status === input.status) {
      throw new ValidationError({ status: ["Select a different status"] });
    }

    let reasonForAudit: string | undefined;
    if (issue.status === "RESOLVED") {
      // AC5 "Back to work": the only way out of Resolved before close.
      if (input.status !== "IN_PROGRESS") {
        throw new ValidationError({ status: ["Select a different status"] });
      }
      if (!input.reason || input.reason.length < ISSUE_REASON_LENGTH.min) {
        throw new ValidationError({ reason: [`Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`] });
      }
      await tx.issueResolution.updateMany({
        where: { issueId: issue.id, supersededAt: null },
        data: { supersededAt: now(), supersededReason: input.reason },
      });
      reasonForAudit = input.reason;
    }

    const updated = await tx.issue.update({ where: { id: issue.id }, data: { status: input.status, ...(await pauseData(tx, issue, input.status, now())), version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: "Status", oldValue: ISSUE_STATUS_LABELS[issue.status], newValue: ISSUE_STATUS_LABELS[input.status] }],
      reason: reasonForAudit,
    });
    if (input.note && input.note.trim().length > 0) {
      await tx.issueNote.create({
        data: { issueId: issue.id, kind: "NOTE", body: input.note.trim(), authorId: user.id, authorName: user.name, authorTeam: user.team, createdAt: now() },
      });
    }
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} status changed from ${ISSUE_STATUS_LABELS[issue.status]} to ${ISSUE_STATUS_LABELS[input.status]} by ${user.name}`,
    });

    return updated;
  });
}

const CASCADE_STATUSES: IssueStatus[] = ["NEW", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "WAITING_ON_PARTNER"];

/**
 * Brief M21 AC4, M23 AC11, AC12. On a partner issue with active linked
 * issues in an open status, the first call with no `confirmCascade`
 * returns a 409 carrying the count instead of resolving, so the client
 * can show "Resolve <ID> and <n> linked issues?" before the real write;
 * the client re-sends with `confirmCascade: true` to proceed. Closing
 * (closeIssue()) never cascades -- each communicator closes their own.
 */
export async function resolveIssue(user: SessionUser, issueId: string, input: ResolveIssueInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (issue.status === "NEW") {
      throw new ValidationError({ status: ["Acknowledge the issue first"] });
    }
    if (issue.status === "RESOLVED" || issue.status === "CLOSED") {
      throw new ValidationError({ status: ["This issue is already resolved"] });
    }

    const cascadeChildren = await tx.issueLink.findMany({
      where: { parentId: issue.id, unlinkedAt: null, child: { status: { in: CASCADE_STATUSES } } },
      select: { child: { select: { id: true, number: true, entityId: true, notifiedAt: true, status: true, severity: true } } },
    });
    // Times rule 7: Event is needed for a Sev-1 (or a Sev-1 linked issue) and the one entered on the partner issue applies to every linked issue.
    const enteredEvent = !issue.eventAt && input.eventAt ? new Date(input.eventAt) : null;
    const eventAfterResolve = issue.eventAt ?? enteredEvent;
    if (enteredEvent) {
      const errors = checkTimes({ eventAt: enteredEvent, awareAt: issue.awareAt, now: now() });
      if (errors.eventAt) throw new ValidationError({ eventAt: [errors.eventAt] });
    }
    const needsEvent = resolveNeedsEvent(issue) || cascadeChildren.some((c) => resolveNeedsEvent({ severity: c.child.severity, eventAt: eventAfterResolve }));
    if (needsEvent && !eventAfterResolve) {
      throw new ValidationError({ eventAt: ["Enter when the problem started. It is needed for the root cause report"] });
    }
    if (cascadeChildren.length > 0 && !input.confirmCascade) {
      throw new ConflictError(`Resolve ${issueDisplayId(issue.number)} and ${cascadeChildren.length} linked issue${cascadeChildren.length === 1 ? "" : "s"}?`, true);
    }

    const t = now();
    const updated = await tx.issue.update({ where: { id: issue.id }, data: { status: "RESOLVED", resolvedAt: t, ...(await pauseData(tx, issue, "RESOLVED", t)), ...(enteredEvent ? { eventAt: enteredEvent } : {}), version: { increment: 1 } } });
    await tx.issueResolution.create({ data: { issueId: issue.id, rootCause: input.rootCause, solution: input.solution, resolvedAt: t, resolvedById: user.id } });

    const rootCauseExcerpt = input.rootCause.length > 80 ? `${input.rootCause.slice(0, 80)}...` : input.rootCause;
    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [
        { field: "Status", oldValue: ISSUE_STATUS_LABELS[issue.status], newValue: ISSUE_STATUS_LABELS.RESOLVED },
        { field: "Root cause", oldValue: null, newValue: input.rootCause },
        { field: "Solution", oldValue: null, newValue: input.solution },
        ...(enteredEvent ? [{ field: "Event", oldValue: "Unknown", newValue: enteredEvent.toISOString() }] : []),
      ],
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} resolved by ${user.name}. Root cause: ${rootCauseExcerpt}`,
    });
    // The cascade, in one statement per kind of row (not per child): this whole function runs inside one transaction that is
    // clocked from its start, and on a database a network hop away every extra statement is tens of milliseconds.
    const actor = { userId: user.id, userName: user.name, userTeam: user.team };
    if (cascadeChildren.length > 0) {
      const children = cascadeChildren.map((c) => c.child);
      await tx.issue.updateMany({ where: { id: { in: children.map((c) => c.id) } }, data: { status: "RESOLVED", resolvedAt: t, ...(enteredEvent ? { eventAt: enteredEvent } : {}), version: { increment: 1 } } });
      await tx.issueResolution.createMany({
        data: children.map((c) => ({ issueId: c.id, rootCause: input.rootCause, solution: input.solution, resolvedAt: t, resolvedById: user.id, cascadedFromIssueId: issue.id })),
      });
      const noteBody = `Resolved with partner issue ${issueDisplayId(issue.number)} by ${user.name} (${TEAM_LABELS[user.team]})`;
      await tx.issueNote.createMany({ data: children.map((c) => ({ issueId: c.id, kind: "SYSTEM" as const, body: noteBody, authorName: "Customer Hub", createdAt: t })) });

      const withAction = children.map((c) => ({ child: c, actionId: randomUUID() }));
      await recordFieldsMany(
        tx,
        withAction.map(({ child, actionId }) => ({
          actionId,
          entityId: child.entityId,
          objectType: "ISSUE" as const,
          objectId: child.id,
          objectLabel: `Issue: ${issueDisplayId(child.number)}`,
          fields: [
            { field: "Status", oldValue: ISSUE_STATUS_LABELS[child.status], newValue: ISSUE_STATUS_LABELS.RESOLVED },
            { field: "Root cause", oldValue: null, newValue: input.rootCause },
            { field: "Solution", oldValue: null, newValue: input.solution },
          ],
          actor,
          createdAt: t,
        })),
      );
      await addHistoryMany(
        tx,
        withAction.map(({ child, actionId }) => ({
          entityId: child.entityId,
          category: "INCIDENT" as const,
          summary: `${issueDisplayId(child.number)} resolved: cascaded from partner issue ${issueDisplayId(issue.number)}`,
          actionId,
          createdAt: t,
          issueId: child.id,
          actorId: user.id,
          actorName: user.name,
          actorTeam: user.team,
        })),
      );
    }

    // M27 AC1: a root cause report task on the issue and on each cascaded child that is Sev-1 at a regulated customer (the partner issue never gets one).
    await createReportTasksIfDue(tx, { issueIds: [issue.id, ...cascadeChildren.map((c) => c.child.id)], resolvedAt: t, actor });

    return updated;
  });
}

/** Brief M21 AC6. */
export async function addContributor(user: SessionUser, issueId: string, input: AddContributorInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);

    const candidate = await tx.user.findUnique({ where: { id: input.userId } });
    if (!candidate || !candidate.active) {
      throw new ValidationError({ userId: ["Select an active user"] });
    }
    if (candidate.id === issue.ownerId) {
      throw new ValidationError({ userId: ["Already on this issue"] });
    }
    const entity = await tx.entity.findUnique({ where: { id: issue.entityId }, select: { ownerId: true } });
    const communicatorId = effectiveCommunicator(issue, { ownerId: entity?.ownerId ?? null }, now());
    if (candidate.id === communicatorId) {
      throw new ValidationError({ userId: ["Already on this issue"] });
    }
    const existing = await tx.issueContributor.findFirst({ where: { issueId: issue.id, userId: candidate.id, removedAt: null } });
    if (existing) {
      throw new ValidationError({ userId: ["Already on this issue"] });
    }

    await tx.issueContributor.create({ data: { issueId: issue.id, userId: candidate.id, addedAt: now() } });
    await tx.issue.update({ where: { id: issue.id }, data: { version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ Contributor: candidate.name }),
    });
    await log.history({ category: "INCIDENT", issueId: issue.id, summary: `${candidate.name} added as contributor to ${issueDisplayId(issue.number)}` });

    return issue;
  });
}

/** Brief M21 AC6. The row stays (`removedAt`); the audit entry names the actor. */
export async function removeContributor(user: SessionUser, issueId: string, contributorUserId: string, input: RemoveContributorInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);

    const contributor = await tx.issueContributor.findFirst({
      where: { issueId: issue.id, userId: contributorUserId, removedAt: null },
      include: { user: { select: { name: true } } },
    });
    if (!contributor) throw new NotFoundError();

    await tx.issueContributor.update({ where: { id: contributor.id }, data: { removedAt: now() } });
    await tx.issue.update({ where: { id: issue.id }, data: { version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: "Contributor", oldValue: contributor.user.name, newValue: null }],
    });
    await log.history({ category: "INCIDENT", issueId: issue.id, summary: `${contributor.user.name} removed as contributor from ${issueDisplayId(issue.number)}` });

    return issue;
  });
}

/** Brief M21 AC8-AC10, AC11 edge case 5. Owner team only; a CREATED linked issue has none (6C). */
export async function reassignIssue(user: SessionUser, issueId: string, input: ReassignIssueInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.owner");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsOwner(tx, issue, user);
    if (issue.routingRule === "INHERITED_FROM_PARENT") {
      throw new IssueForbiddenError("linked_follows_parent", "This issue follows the owner of its partner issue");
    }
    if (input.newOwnerId === issue.ownerId) {
      throw new ValidationError({ newOwnerId: ["Select a different owner"] });
    }

    const newOwner = await tx.user.findUnique({ where: { id: input.newOwnerId } });
    if (!newOwner || !newOwner.active || newOwner.team !== issue.ownerTeam) {
      throw new ValidationError({ newOwnerId: ["Select a different owner"] });
    }
    const priorOwner = issue.ownerId ? await tx.user.findUnique({ where: { id: issue.ownerId }, select: { name: true } }) : null;

    const t = now();
    const outsideHours = !isInBusinessHours(t, userCalendar(newOwner));
    const updated = await tx.issue.update({ where: { id: issue.id }, data: { ownerId: newOwner.id, ownerSince: t, version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: updateFields({ Owner: priorOwner?.name ?? null }, { Owner: newOwner.name }),
      reason: input.reason,
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} reassigned from ${priorOwner?.name ?? "no owner"} to ${newOwner.name}: ${input.reason}`,
    });
    await syncCreatedChildrenOwner(tx, issue.id, newOwner.id, newOwner.name, user);

    const outsideHoursText = outsideHours
      ? `${newOwner.name} is outside business hours (${formatInZone(t, effectiveTimeZone(newOwner), { timeOnly: true })} in ${zoneCity(effectiveTimeZone(newOwner))}). The issue keeps its current deadlines.`
      : null;

    return { ...updated, outsideHours, outsideHoursText };
  });
}

/** Brief M21 AC7. Any active user of the 6 teams. */
export async function addIssueNote(user: SessionUser, issueId: string, input: AddIssueNoteInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.report");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId }, select: { id: true, number: true } });
    if (!issue) throw new NotFoundError();

    await tx.issueNote.create({
      data: { issueId: issue.id, kind: "NOTE", body: input.body, authorId: user.id, authorName: user.name, authorTeam: user.team, createdAt: now() },
    });
    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({ Note: input.body }),
    });
    await log.history({ category: "INCIDENT", issueId: issue.id, summary: `Note added to ${issueDisplayId(issue.number)} by ${user.name}` });

    return issue;
  });
}
