import type { CoverageStatus, Scheme } from "@prisma/client";

import { db } from "@/server/db";
import { now as demoNow, today, toLocalDate } from "@/lib/dates";
import { formatInZone } from "@/lib/time-zones";
import { computeClocks } from "@/server/derived/issue-clocks";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { effectiveCommunicator } from "@/server/derived/communicator";
import { teamCalendar, userCalendar, type Calendar } from "@/lib/business-hours";
import { COMMUNICATION_CHANNEL_LABELS } from "@/lib/labels";

// Brief 4.9.8, M23 AC4, AC9, AC10. Small, page-scoped read helpers for
// the partner-issue panels -- each is cheap enough to compute inline
// with the rest of the Issue page's single load, unlike the report
// drawer's on-demand `issue-context` route (this data is always on
// screen for a partner issue, never opened lazily from several pages).

export interface DegradedProposal {
  coverageId: string;
  coverageVersion: number;
  scheme: Scheme;
  country: string;
  status: CoverageStatus | null;
  effectiveDate: string | null;
  changedSinceCreation: { byName: string; at: Date } | null;
}

/** AC4. null when the issue has no scheme/country or the entity has no partner role (not a partner issue). */
export async function loadDegradedProposal(entityId: string, scheme: Scheme | null, country: string | null, issueCreatedAt: Date): Promise<DegradedProposal | null> {
  if (!scheme || !country) return null;
  const role = await db.partnerRole.findUnique({ where: { entityId }, select: { coverage: { where: { scheme, country } } } });
  const coverage = role?.coverage[0];
  if (!coverage) return null;

  const changes = await db.coverageStatusChange.findMany({ where: { coverageId: coverage.id }, include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
  const { current } = computeCoverageStatus(changes.map((c) => ({ ...c, effectiveDate: toLocalDate(c.effectiveDate) })), today());
  const sinceCreation = changes.filter((c) => c.createdAt >= issueCreatedAt);
  const latestSinceCreation = sinceCreation.length > 0 ? sinceCreation[sinceCreation.length - 1] : null;

  return {
    coverageId: coverage.id,
    coverageVersion: coverage.version,
    scheme,
    country,
    status: current?.status ?? null,
    effectiveDate: current?.effectiveDate ?? null,
    changedSinceCreation: latestSinceCreation ? { byName: latestSinceCreation.user.name, at: latestSinceCreation.createdAt } : null,
  };
}

export interface LinkedIssueRow {
  linkId: string;
  kind: "CREATED" | "ATTACHED";
  childId: string;
  number: number;
  entityName: string;
  entityDeleted: boolean;
  communicatorName: string | null;
  status: string;
  clockText: string | null;
  notified: boolean;
}

/** AC10. */
export async function loadLinkedIssuesPanel(parentIssueId: string, viewerZone: string): Promise<{ rows: LinkedIssueRow[]; notifiedCount: number }> {
  const links = await db.issueLink.findMany({
    where: { parentId: parentIssueId, unlinkedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      child: {
        include: {
          entity: { select: { legalName: true, deletedAt: true, ownerId: true, owner: { select: { id: true, name: true, team: true, timeZone: true } } } },
          owner: { select: { id: true, name: true, team: true, timeZone: true } },
        },
      },
    },
  });

  const now = demoNow(); // the server demo clock, never the machine clock
  const rows: LinkedIssueRow[] = links.map((link) => {
    const child = link.child;
    if (child.entity.deletedAt) {
      return { linkId: link.id, kind: link.kind, childId: child.id, number: child.number, entityName: child.entity.legalName, entityDeleted: true, communicatorName: null, status: child.status, clockText: null, notified: !!child.notifiedAt };
    }
    const communicatorId = effectiveCommunicator(child, { ownerId: child.entity.ownerId }, now);
    const communicator = communicatorId === child.ownerId ? child.owner : communicatorId === child.entity.ownerId ? child.entity.owner : null;
    const communicatorCalendar: Calendar | null = communicator ? userCalendar(communicator) : null;
    const ownerCalendar: Calendar | null = child.owner ? teamCalendar(child.ownerTeam, child.owner) : teamCalendar(child.ownerTeam);
    const clocks = computeClocks(
      {
        severity: child.severity,
        status: child.status,
        severityCapLabel: child.severityCapLabel,
        clocksStartAt: child.clocksStartAt,
        ackStartAt: child.ackStartAt,
        acknowledgedAt: child.acknowledgedAt,
        notifyRequired: child.notifyRequired,
        notifyStartAt: child.notifyStartAt,
        notifyTargetHours: child.notifyTargetHours,
        notifyDefaultTarget: child.notifyDefaultTarget,
        notifyTargetBusinessMins: child.notifyTargetBusinessMins,
        notifiedAt: child.notifiedAt,
        complianceFlaggedAt: null,
        complianceClockStartAt: null,
        firstAssessmentAt: null,
      },
      { ownerCalendar, communicatorCalendar, viewerZone },
      now,
    );
    const text = child.notifiedAt ? `Customer notified ${formatInZone(child.notifiedAt, viewerZone)}` : clocks.notify.text;
    return {
      linkId: link.id,
      kind: link.kind,
      childId: child.id,
      number: child.number,
      entityName: child.entity.legalName,
      entityDeleted: false,
      communicatorName: communicator?.name ?? null,
      status: child.status,
      clockText: text,
      notified: !!child.notifiedAt,
    };
  });

  return { rows, notifiedCount: rows.filter((r) => r.notified).length };
}

export interface DualRoleBanner {
  parentId: string;
  parentNumber: number;
  lastPartnerCommunication: string;
}

/** AC9. null unless this issue is a CREATED/ATTACHED child whose parent's entity equals this issue's own entity (Lloyds Bank plc case). Time shown in the viewer's own zone, like every other clock/time text on this page. */
export async function loadDualRoleBanner(childIssueId: string, childEntityId: string, viewerZone: string): Promise<DualRoleBanner | null> {
  const link = await db.issueLink.findFirst({
    where: { childId: childIssueId, unlinkedAt: null },
    include: { parent: { select: { id: true, number: true, entityId: true } } },
  });
  if (!link || link.parent.entityId !== childEntityId) return null;

  const lastComm = await db.issueCommunication.findFirst({
    where: { issueId: link.parent.id, type: { not: "SYSTEM" } },
    orderBy: { occurredAt: "desc" },
    select: { occurredAt: true, personName: true, channel: true },
  });
  return {
    parentId: link.parent.id,
    parentNumber: link.parent.number,
    lastPartnerCommunication: lastComm
      ? `Network last contacted the partner at ${formatInZone(lastComm.occurredAt, viewerZone)}: ${lastComm.personName ?? "—"}, ${lastComm.channel ? COMMUNICATION_CHANNEL_LABELS[lastComm.channel].toLowerCase() : "—"}`
      : "Network has not contacted the partner yet",
  };
}
