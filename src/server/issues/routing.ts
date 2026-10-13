import type { CommunicatorRule, IssueType, Prisma, RoutingRule, Severity, Team } from "@prisma/client";

import { isInBusinessHours, nextBusinessStart, teamCalendar, userCalendar } from "@/lib/business-hours";
import { ROUTING_RULE_REASON, TEAM_LABELS } from "@/lib/labels";
import { ISSUE_TYPE_ROUTING, ON_CALL_TEAMS, SALES_DIRECTOR_EMAIL } from "@/server/config";
import { ValidationError } from "@/server/errors";

// Brief 4.9.2. routeIssue() runs inside the report transaction at save
// time (and again on a type change, M19 AC17). Not pure: needs the
// entity's named issue-team person and the on-call rota, both DB rows.

export interface RoutingPerson {
  id: string;
  name: string;
  timeZone: string;
  team: Team;
  active: boolean;
}

export interface RoutingEntity {
  id: string;
  legalName: string;
  ownerId: string | null;
  owner: { id: string; timeZone: string; team: Team } | null;
}

export interface RoutingInput {
  type: IssueType;
  severity: Severity;
  entity: RoutingEntity;
  isPartnerIssue?: boolean; // rule 7, this issue is itself the partner issue
  parent?: { ownerTeam: Team; ownerId: string | null; displayId: string } | null; // rule 7, linked issue created from a partner issue
}

export interface Routing {
  ownerTeam: Team;
  ownerId: string | null;
  rule: RoutingRule;
  routingReason: string;
  clocksStartAt: Date;
  ack: boolean; // false only for a CREATED linked issue (rule 7): no separate acknowledgement
  communicatorRule: CommunicatorRule;
  handoverAt: Date | null;
}

/** The entity's named person in `team` (brief 7.1.17.3). Sales: falls back to the Sales Director when the named user is inactive (M18 edge case 8). */
export async function issueTeamMember(tx: Prisma.TransactionClient, entityId: string, team: Team): Promise<RoutingPerson | null> {
  const row = await tx.issueTeamMember.findUnique({
    where: { entityId_team: { entityId, team } },
    include: { user: { select: { id: true, name: true, timeZone: true, team: true, active: true } } },
  });
  if (!row) return null;
  if (row.user.active) return row.user;
  if (team !== "SALES") return null;
  const director = await tx.user.findUnique({ where: { email: SALES_DIRECTOR_EMAIL }, select: { id: true, name: true, timeZone: true, team: true, active: true } });
  return director?.active ? director : null;
}

/** The on-call person covering `instant` for `team` (3.2.6.1 OnCallShift). */
export async function onCallAt(tx: Prisma.TransactionClient, team: Team, instant: Date): Promise<RoutingPerson | null> {
  const shift = await tx.onCallShift.findFirst({
    where: { team, startsAt: { lte: instant }, endsAt: { gt: instant } },
    include: { user: { select: { id: true, name: true, timeZone: true, team: true, active: true } } },
  });
  return shift?.user ?? null;
}

function communicatorFor(input: RoutingInput, ownerId: string | null, t: Date): { communicatorRule: CommunicatorRule; handoverAt: Date | null } {
  if (input.isPartnerIssue) return { communicatorRule: "ISSUE_OWNER_PARTNER", handoverAt: null }; // rule 7
  const co = input.entity.owner; // customer owner (M9)
  if (input.severity === "SEV1" && co && co.id !== ownerId && !isInBusinessHours(t, userCalendar(co))) {
    // rules 3 and 3b
    return { communicatorRule: "ISSUE_OWNER_UNTIL_HANDOVER", handoverAt: nextBusinessStart(t, userCalendar(co)) };
  }
  return { communicatorRule: "CUSTOMER_OWNER", handoverAt: null }; // M18 AC7
}

export async function routeIssue(tx: Prisma.TransactionClient, input: RoutingInput, t: Date): Promise<Routing> {
  // Rule 7: a linked issue created from a partner issue inherits the parent's owner and needs no acknowledgement
  if (input.parent) {
    const { communicatorRule, handoverAt } = communicatorFor(input, input.parent.ownerId, t);
    return {
      ownerTeam: input.parent.ownerTeam,
      ownerId: input.parent.ownerId,
      rule: "INHERITED_FROM_PARENT",
      routingReason: ROUTING_RULE_REASON.INHERITED_FROM_PARENT({ parentId: input.parent.displayId }),
      clocksStartAt: t,
      ack: false,
      communicatorRule,
      handoverAt,
    };
  }

  const ownerTeam = ISSUE_TYPE_ROUTING[input.type].owner; // rule 1
  const named = await issueTeamMember(tx, input.entity.id, ownerTeam);
  const cal = teamCalendar(ownerTeam, named);
  let ownerId: string | null;
  let rule: RoutingRule;
  let clocksStartAt = t;

  if (isInBusinessHours(t, cal)) {
    // rule 2
    const onCall = named ? null : await onCallAt(tx, ownerTeam, t);
    ownerId = named?.id ?? onCall?.id ?? null;
    rule = named ? "NAMED_PERSON" : "ON_CALL_IN_HOURS";
  } else if (input.severity === "SEV1") {
    // rule 3, plus the PM decision of 5 October 2026 (B19) for a team with no on-call
    if (ON_CALL_TEAMS.includes(ownerTeam)) {
      const onCall = await onCallAt(tx, ownerTeam, t);
      ownerId = onCall?.id ?? null;
      rule = "ON_CALL_OUT_OF_HOURS";
    } else {
      const onCall = await onCallAt(tx, "COMPLIANCE", t);
      ownerId = onCall?.id ?? null;
      rule = "COMPLIANCE_ON_CALL";
    }
  } else {
    // rule 4
    ownerId = named?.id ?? null; // null: filled in at clock start (4.9.7, 6B's ensureSystemWrites())
    rule = "QUEUED_FOR_BUSINESS_HOURS";
    clocksStartAt = nextBusinessStart(t, cal);
  }

  if (!ownerId && rule !== "QUEUED_FOR_BUSINESS_HOURS") {
    throw new ValidationError({ routing: ["Issue not reported: no owner could be found. Try again or contact the admin."] });
  }

  const routingReason = ROUTING_RULE_REASON[rule]({ entity: input.entity.legalName, team: TEAM_LABELS[ownerTeam] });
  const { communicatorRule, handoverAt } = communicatorFor(input, ownerId, t);

  return { ownerTeam, ownerId, rule, routingReason, clocksStartAt, ack: true, communicatorRule, handoverAt };
}
