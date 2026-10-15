import type { IssueStatus, IssueType, Scheme, Severity, Stage } from "@prisma/client";

import { db } from "@/server/db";
import { isLive, loadCoverageCustomers } from "@/server/queries/coverage-customers";
import { addBusinessMinutes, teamCalendar, userCalendar } from "@/lib/business-hours";
import { ISSUE_OPEN_FOR_SIMILAR, NOTIFY_TARGET_SEV1_DEFAULT_HOURS, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES } from "@/server/config";

// Brief 4.9.8, M23 AC5, AC6, AC8, AC13. Computed fresh on every read --
// nothing about "who is affected" is stored. "Communicator" here is the
// customer owner directly (Entity.ownerId), per AC5's own wording, not
// effectiveCommunicator() (which would also apply the hand-over rule --
// not relevant since these rows describe a not-yet-created issue).

interface ProductLineRef {
  id: string;
  scheme: Scheme;
  country: string;
  stage: Stage;
}

export interface AffectedCustomerRow {
  entityId: string;
  entityName: string;
  productLines: ProductLineRef[];
  ownerId: string | null;
  ownerName: string | null;
  incidentNoticeHours: number | null;
  notifyBy: Date | null;
  notifyByDefault: boolean;
  linkedIssue: { id: string; number: number; status: IssueStatus } | null;
  attachCandidates: { id: string; number: number; type: IssueType; severity: Severity; status: IssueStatus }[];
  /** M23 AC8: the row's default action in the "Create linked issues" dialog. */
  defaultAction: "ATTACH" | "CREATE";
  defaultAttachId: string | null;
}

export interface AffectedCustomersResult {
  affected: AffectedCustomerRow[];
  beforeGoLive: { entityId: string; entityName: string; productLines: ProductLineRef[] }[];
}

export async function loadAffectedCustomers(parentIssueId: string, scheme: Scheme, country: string, severity: Severity, awareAt: Date): Promise<AffectedCustomersResult> {
  const existingLinks = await db.issueLink.findMany({
    where: { parentId: parentIssueId, unlinkedAt: null },
    select: { childId: true, child: { select: { id: true, number: true, status: true, entityId: true } } },
  });
  const linkByEntity = new Map(existingLinks.map((l) => [l.child.entityId, l.child]));

  // Who uses this scheme and country: the one shared rule (coverage-customers.ts).
  const byEntity = await loadCoverageCustomers(scheme, country);

  const affected: AffectedCustomerRow[] = [];
  const beforeGoLive: AffectedCustomersResult["beforeGoLive"] = [];

  for (const row of byEntity) {
    const liveLines = row.lines.filter(isLive);
    const earlyLines = row.lines.filter((l) => !isLive(l));
    if (earlyLines.length > 0 && liveLines.length === 0) {
      beforeGoLive.push({ entityId: row.entityId, entityName: row.entityName, productLines: earlyLines.map((l) => ({ id: l.id, scheme, country, stage: l.stage })) });
      continue;
    }
    if (liveLines.length === 0) continue;

    const card = await db.obligationCard.findUnique({ where: { entityId_kind: { entityId: row.entityId, kind: "CUSTOMER_AGREEMENT" } }, select: { incidentNoticeHours: true } });
    let notifyBy: Date | null = null;
    let notifyByDefault = false;
    if (severity === "SEV1") {
      const hours = card?.incidentNoticeHours ?? NOTIFY_TARGET_SEV1_DEFAULT_HOURS;
      notifyByDefault = card?.incidentNoticeHours == null;
      notifyBy = new Date(awareAt.getTime() + hours * 60 * 60_000);
    } else if (severity === "SEV2") {
      const cal = row.ownerId && row.ownerTz && row.ownerTeam ? userCalendar({ timeZone: row.ownerTz, team: row.ownerTeam }) : teamCalendar("OPS");
      notifyBy = addBusinessMinutes(awareAt, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES, cal);
    }

    const linked = linkByEntity.get(row.entityId);
    // Excludes the parent issue itself: on a dual-role entity (Lloyds Bank plc), the partner
    // issue being fanned out is itself an "open issue on this entity/scheme/country" and must
    // never offer itself as its own attach candidate.
    const attachCandidates = linked
      ? []
      : await db.issue.findMany({
          where: { entityId: row.entityId, scheme, country, status: { in: ISSUE_OPEN_FOR_SIMILAR }, id: { not: parentIssueId } },
          select: { id: true, number: true, type: true, severity: true, status: true },
          orderBy: { number: "desc" },
        });
    // AC8: default to attaching the most recent open issue of a matching type; otherwise create.
    const attachDefault = attachCandidates.find((c) => c.type === "SERVICE_UNAVAILABLE" || c.type === "PARTNER_DEGRADED") ?? null;

    affected.push({
      entityId: row.entityId,
      entityName: row.entityName,
      productLines: liveLines.map((l) => ({ id: l.id, scheme, country, stage: l.stage })),
      ownerId: row.ownerId,
      ownerName: row.ownerName,
      incidentNoticeHours: card?.incidentNoticeHours ?? null,
      notifyBy,
      notifyByDefault,
      linkedIssue: linked ? { id: linked.id, number: linked.number, status: linked.status } : null,
      attachCandidates,
      defaultAction: attachDefault ? "ATTACH" : "CREATE",
      defaultAttachId: attachDefault?.id ?? null,
    });
  }

  affected.sort((a, b) => (a.notifyBy?.getTime() ?? Infinity) - (b.notifyBy?.getTime() ?? Infinity));
  return { affected, beforeGoLive };
}
