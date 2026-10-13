import { cache } from "react";

import { now } from "@/lib/dates";
import { db } from "@/server/db";
import { loadEntityCore } from "@/server/queries/entity-core";
import { ON_CALL_TEAMS, SALES_DIRECTOR_EMAIL } from "@/server/config";
import { onCallAt, type RoutingPerson } from "@/server/issues/routing";

export interface IssueTeamData {
  members: Record<"SALES" | "OPS" | "NETWORK" | "FINANCE" | "COMPLIANCE", RoutingPerson | null>;
  salesIsFallback: boolean;
  onCall: Record<"OPS" | "NETWORK" | "COMPLIANCE", RoutingPerson | null>;
}

/** Brief 4.9.2 "Why this owner", M18 AC3, AC4, edge case 8. Read-only Details-tab block (6A). */
async function loadIssueTeam(entityId: string): Promise<IssueTeamData | null> {
  const rows = await db.issueTeamMember.findMany({
    where: { entityId },
    include: { user: { select: { id: true, name: true, timeZone: true, team: true, active: true } } },
  });
  if (rows.length === 0) return null;

  const byTeam = new Map(rows.map((r) => [r.team, r.user]));
  let sales = byTeam.get("SALES") ?? null;
  let salesIsFallback = false;
  if (sales && !sales.active) {
    const director = await db.user.findUnique({
      where: { email: SALES_DIRECTOR_EMAIL },
      select: { id: true, name: true, timeZone: true, team: true, active: true },
    });
    sales = director?.active ? director : null;
    salesIsFallback = sales !== null;
  }

  const [opsOnCall, networkOnCall, complianceOnCall] = await Promise.all(ON_CALL_TEAMS.map((team) => onCallAt(db, team, now())));

  return {
    members: {
      SALES: sales,
      OPS: byTeam.get("OPS") ?? null,
      NETWORK: byTeam.get("NETWORK") ?? null,
      FINANCE: byTeam.get("FINANCE") ?? null,
      COMPLIANCE: byTeam.get("COMPLIANCE") ?? null,
    },
    salesIsFallback,
    onCall: { OPS: opsOnCall, NETWORK: networkOnCall, COMPLIANCE: complianceOnCall },
  };
}

export const loadDetailsData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const [customerRole, partnerRole, groupMembers, issueTeam] = await Promise.all([
    entity.customerRole?.active
      ? db.customerRole.findUnique({
          where: { entityId: id },
          include: {
            contract: {
              include: {
                invoicedEntity: { select: { legalName: true } },
                customerRoles: { select: { entityId: true } },
              },
            },
            volumeTiers: { orderBy: { position: "asc" } },
          },
        })
      : null,
    entity.partnerRole?.active
      ? db.partnerRole.findUnique({
          where: { entityId: id },
          include: { partnerAgreement: true },
        })
      : null,
    entity.groupId ? db.entity.findMany({ where: { groupId: entity.groupId }, select: { id: true, legalName: true } }) : Promise.resolve([]),
    loadIssueTeam(id),
  ]);

  return { entity, customerRole, partnerRole, groupMembers, issueTeam };
});

export type DetailsData = NonNullable<Awaited<ReturnType<typeof loadDetailsData>>>;
