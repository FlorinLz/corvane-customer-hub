import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { db } from "@/server/db";
import { now } from "@/lib/dates";
import { recordFields, recordFieldsMany, createFields } from "@/server/audit/record";
import { addHistory, addHistoryMany } from "@/server/audit/history";
import { SCHEME_LABELS, TEAM_LABELS, ISSUE_TYPE_LABELS, SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { onCallAt, routeIssue, type RoutingPerson } from "@/server/issues/routing";
import { complianceReasons } from "@/server/issues/compliance";
import { chooseComplianceAssessor } from "@/server/issues/compliance-assessor";
import { assertIsOwner, requireIssueEntity } from "@/server/issues/roles";
import type { CreateLinkedIssuesInput, UnlinkIssueInput } from "@/lib/validation/issues";
import { ISSUE_OPEN_FOR_SIMILAR, NOTIFY_TARGET_SEV2_BUSINESS_MINUTES, TRANSACTION_OPTIONS } from "@/server/config";
import { ConflictError, IssueForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/permissions/can";

// Brief 4.9.8, M23 AC7-AC9, AC14, AC16, AC17. These writes touch TWO
// entities (the partner and each affected customer) in one transaction,
// so they bypass the single-entity mutate() wrapper and call
// recordFields()/addHistory() directly per entity, the same primitives
// mutate() itself uses -- matching communicator-sync.ts's precedent for
// a write that can't be pinned to one ctx.entityId.

/**
 * Brief M23 AC7, AC8, AC15. Owner of the partner issue only. All rows in one transaction, all or none.
 *
 * Round trips: this is one interactive transaction, clocked from its start, on a database a network hop away. So it reads
 * once per kind (the parent, every ATTACH target and its links, every affected entity, card and named person) and writes once
 * per kind (the new issues, contributors, links, audit and History), however many customers are ticked.
 */
export async function createLinkedIssues(user: SessionUser, parentIssueId: string, input: CreateLinkedIssuesInput) {
  const { entityId: parentEntityId } = await requireIssueEntity(parentIssueId, user, "issue.owner");

  try {
    return await db.$transaction(async (tx) => {
      const parent = await tx.issue.findUniqueOrThrow({ where: { id: parentIssueId }, include: { entity: { select: { legalName: true } } } });
      if (parent.version !== input.version) {
        throw new ConflictError("This issue was changed. Reload to see the current state.");
      }
      await assertIsOwner(tx, parent, user);

      const actor = { userId: user.id, userName: user.name, userTeam: user.team };
      const linkRows: Prisma.IssueLinkCreateManyInput[] = [];
      const history: Parameters<typeof addHistoryMany>[1] = [];
      const audit: Parameters<typeof recordFieldsMany>[1] = [];

      // ATTACH rows. Re-derive eligibility server-side rather than trusting the client's issueId:
      // loadAffectedCustomers() computes the same candidate shape (same entity, scheme,
      // country, open status, not the parent itself) for the dialog, but a forged or
      // stale request could otherwise attach an unrelated or already-linked issue.
      const attachRows = input.rows.filter((r): r is Extract<typeof r, { action: "ATTACH" }> => r.action === "ATTACH");
      if (attachRows.length > 0) {
        const attachIds = attachRows.map((r) => r.issueId);
        const [targets, linked] = await Promise.all([
          tx.issue.findMany({ where: { id: { in: attachIds } } }),
          tx.issueLink.findMany({ where: { childId: { in: attachIds }, unlinkedAt: null }, select: { childId: true } }),
        ]);
        const targetOf = new Map(targets.map((x) => [x.id, x]));
        const linkedIds = new Set(linked.map((l) => l.childId));
        const attachedAt = now();
        for (const row of attachRows) {
          const target = targetOf.get(row.issueId);
          if (
            !target ||
            target.id === parentIssueId ||
            target.entityId !== row.entityId ||
            target.scheme !== parent.scheme ||
            target.country !== parent.country ||
            !ISSUE_OPEN_FOR_SIMILAR.includes(target.status)
          ) {
            throw new ValidationError({ rows: ["This issue can no longer be attached. Reload and try again."] });
          }
          if (linkedIds.has(target.id)) {
            throw new ValidationError({ rows: ["This issue is already linked. Reload and try again."] });
          }
          linkedIds.add(target.id); // the same issue twice in one request is "already linked" too
          linkRows.push({ parentId: parentIssueId, childId: target.id, kind: "ATTACHED", createdById: user.id, createdAt: attachedAt });
          history.push(...linkHistoryEvents(randomUUID(), user, parent.entity.legalName, parentEntityId, parent.number, row.entityId, target.id, target.number, parent.scheme, parent.country, "attached", attachedAt));
        }
      }

      // CREATE rows.
      const createRows = input.rows.filter((r): r is Extract<typeof r, { action: "CREATE" }> => r.action === "CREATE");
      const created: { id: string; number: number }[] = [];
      if (createRows.length > 0) {
        const entityIds = [...new Set(createRows.map((r) => r.entityId))];
        const [entities, cards, members] = await Promise.all([
          tx.entity.findMany({ where: { id: { in: entityIds } }, include: { owner: { select: { id: true, timeZone: true, team: true } } } }),
          tx.obligationCard.findMany({ where: { entityId: { in: entityIds }, kind: "CUSTOMER_AGREEMENT" }, select: { entityId: true, regulatoryRegime: true, incidentNoticeHours: true } }),
          tx.issueTeamMember.findMany({
            where: { entityId: { in: entityIds }, team: { in: ["OPS", "COMPLIANCE"] } },
            include: { user: { select: { id: true, name: true, timeZone: true, team: true, active: true } } },
          }),
        ]);
        const entityOf = new Map(entities.map((e) => [e.id, e]));
        const cardOf = new Map(cards.map((c) => [c.entityId, c]));
        const memberOf = (entityId: string, team: "OPS" | "COMPLIANCE") => members.find((m) => m.entityId === entityId && m.team === team) ?? null;

        const t = now();
        let onCallCompliance: Promise<RoutingPerson | null> | null = null;
        const onCall = () => (onCallCompliance ??= onCallAt(tx, "COMPLIANCE", t));
        const status = parent.acknowledgedAt ? "IN_PROGRESS" : "NEW";
        const data: Prisma.IssueCreateManyInput[] = [];
        for (const row of createRows) {
          const e = entityOf.get(row.entityId);
          if (!e) throw new NotFoundError();
          const routing = await routeIssue(
            tx,
            { type: parent.type, severity: parent.severity, entity: { id: e.id, legalName: e.legalName, ownerId: e.ownerId, owner: e.owner }, parent: { ownerTeam: parent.ownerTeam, ownerId: parent.ownerId, displayId: issueDisplayId(parent.number) } },
            t,
          );
          const card = cardOf.get(row.entityId) ?? null;
          const notifyTargetHours = parent.severity === "SEV1" ? card?.incidentNoticeHours ?? null : null;
          const notifyDefaultTarget = parent.severity === "SEV1" && notifyTargetHours === null;
          const notifyTargetBusinessMins = parent.severity === "SEV2" ? NOTIFY_TARGET_SEV2_BUSINESS_MINUTES : null;

          const reasons = complianceReasons({ possibleBreach: parent.possibleBreach, type: parent.type, severity: parent.severity }, card, false);
          const namedCompliance = memberOf(row.entityId, "COMPLIANCE");
          const assessor =
            reasons.length > 0
              ? await chooseComplianceAssessor(tx, row.entityId, parent.severity, t, { named: namedCompliance?.user.active ? namedCompliance.user : null, onCall })
              : null;

          data.push({
            entityId: row.entityId,
            productId: row.productId ?? null,
            scheme: parent.scheme,
            country: parent.country,
            type: parent.type,
            impact: parent.impact,
            possibleBreach: parent.possibleBreach,
            proposedSeverity: parent.severity,
            severity: parent.severity,
            description: `Linked to ${issueDisplayId(parent.number)}: ${parent.entity.legalName} ${parent.scheme ? SCHEME_LABELS[parent.scheme] : ""} / ${parent.country ?? ""} partner issue.\n\n${parent.description}`,
            awareAt: parent.awareAt,
            eventAt: parent.eventAt,
            awarenessSource: parent.awarenessSource,
            reporterKind: "USER",
            reporterId: user.id,
            reporterTeam: user.team,
            customerReporterKind: "FOUND_INTERNALLY",
            status,
            ownerTeam: routing.ownerTeam,
            ownerId: routing.ownerId,
            ownerSince: routing.ownerId ? t : null,
            routingRule: "INHERITED_FROM_PARENT",
            routingReason: routing.routingReason,
            communicatorRule: routing.communicatorRule,
            handoverAt: routing.handoverAt,
            clocksStartAt: t,
            ackStartAt: null,
            ackDueAt: null,
            notifyRequired: parent.severity === "SEV1" || parent.severity === "SEV2",
            notifyStartAt: parent.awareAt,
            notifyTargetHours,
            notifyDefaultTarget,
            notifyTargetBusinessMins,
            complianceFlaggedAt: reasons.length > 0 ? t : null,
            complianceReasons: reasons,
            complianceClockStartAt: reasons.length > 0 && parent.severity === "SEV1" ? t : null,
            complianceAssessorId: assessor?.assessorId ?? null,
            complianceVisibleFrom: assessor?.visibleFrom ?? null,
            createdAt: t,
          });
        }

        // One insert for every new issue (their numbers come from the sequence, in row order).
        const children = await tx.issue.createManyAndReturn({ data, select: { id: true, number: true, entityId: true, description: true } });
        const contributors: Prisma.IssueContributorCreateManyInput[] = [];
        children.forEach((child, i) => {
          const row = createRows[i];
          if (child.entityId !== row.entityId) throw new Error("createManyAndReturn returned the rows out of order");
          // AC7: default contributor = the customer's named Ops person (routing rule 5), unconditionally.
          const namedOps = memberOf(row.entityId, "OPS");
          if (namedOps) contributors.push({ issueId: child.id, userId: namedOps.userId, isDefault: true, addedAt: t });
          linkRows.push({ parentId: parentIssueId, childId: child.id, kind: "CREATED", createdById: user.id, createdAt: t });

          const actionId = randomUUID();
          audit.push({
            actionId,
            entityId: row.entityId,
            objectType: "ISSUE",
            objectId: child.id,
            objectLabel: `Issue: ${issueDisplayId(child.number)}`,
            fields: createFields({ Type: ISSUE_TYPE_LABELS[parent.type], Severity: SEVERITY_LABELS[parent.severity], Description: child.description, Routing: data[i].routingReason as string }),
            actor,
            createdAt: t,
          });
          history.push(...linkHistoryEvents(actionId, user, parent.entity.legalName, parentEntityId, parent.number, row.entityId, child.id, child.number, parent.scheme, parent.country, "created", t));
          created.push({ id: child.id, number: child.number });
        });
        if (contributors.length > 0) await tx.issueContributor.createMany({ data: contributors });
      }

      if (linkRows.length > 0) await tx.issueLink.createMany({ data: linkRows });
      await recordFieldsMany(tx, audit);
      await addHistoryMany(tx, history);
      return created;
    }, TRANSACTION_OPTIONS);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof ConflictError || err instanceof IssueForbiddenError || err instanceof NotFoundError) throw err;
    throw new ValidationError({ rows: ["Linked issues not created. Nothing was saved. Try again."] });
  }
}

/** The two History events of a link (on the partner's record and on the customer's), for `addHistoryMany()`. */
function linkHistoryEvents(
  actionId: string,
  user: SessionUser,
  partnerName: string,
  parentEntityId: string,
  parentNumber: number,
  childEntityId: string,
  childId: string,
  childNumber: number,
  scheme: string | null,
  country: string | null,
  verb: "created" | "attached",
  createdAt: Date,
): Parameters<typeof addHistoryMany>[1] {
  const schemeCountry = scheme && country ? `${SCHEME_LABELS[scheme as keyof typeof SCHEME_LABELS]}, ${country}` : "";
  const summary = `Linked issue ${issueDisplayId(childNumber)} ${verb} from partner issue ${issueDisplayId(parentNumber)} (${partnerName}${schemeCountry ? `, ${schemeCountry}` : ""}). By ${user.name}, ${TEAM_LABELS[user.team]}.`;
  const base = { category: "INCIDENT" as const, summary, actionId, issueId: childId, actorId: user.id, actorName: user.name, actorTeam: user.team, createdAt };
  return [{ ...base, entityId: parentEntityId }, { ...base, entityId: childEntityId }];
}

/** Brief M23 AC14. Owner of the partner issue only. */
export async function unlinkIssue(user: SessionUser, linkId: string, input: UnlinkIssueInput) {
  const link = await db.issueLink.findUnique({ where: { id: linkId }, include: { parent: true, child: { select: { entityId: true, number: true } } } });
  if (!link) throw new NotFoundError();
  if (link.unlinkedAt) throw new ValidationError({ reason: ["This issue is already unlinked"] });

  return db.$transaction(async (tx) => {
    await assertIsOwner(tx, link.parent, user);
    const t = now();
    await tx.issueLink.update({ where: { id: linkId }, data: { unlinkedAt: t, unlinkedById: user.id, unlinkReason: input.reason } });

    const actionId = randomUUID();
    await recordFields(tx, {
      actionId,
      entityId: link.child.entityId,
      objectType: "ISSUE",
      objectId: link.childId,
      objectLabel: `Issue: ${issueDisplayId(link.child.number)}`,
      fields: createFields({ Unlinked: `from ${issueDisplayId(link.parent.number)}: ${input.reason}` }),
      actor: { userId: user.id, userName: user.name, userTeam: user.team },
      createdAt: t,
    });
    await addHistory(tx, {
      entityId: link.child.entityId,
      category: "INCIDENT",
      summary: `${issueDisplayId(link.child.number)} unlinked from partner issue ${issueDisplayId(link.parent.number)} by ${user.name}: ${input.reason}`,
      actionId,
      actorId: user.id,
      actorName: user.name,
      actorTeam: user.team,
      createdAt: t,
    });
  }, TRANSACTION_OPTIONS);
}

/**
 * Brief M23 AC17. Every active CREATED child of `parentIssueId` gets the
 * parent's new owner, one audit entry per child, in the CALLER's own
 * transaction (reassignIssue()/changeType() pass their own `tx`). Each
 * child keeps its own entityId for the audit/History write, which is
 * why this can't go through the caller's single-entity `log`.
 */
export async function syncCreatedChildrenOwner(tx: Prisma.TransactionClient, parentIssueId: string, newOwnerId: string, newOwnerName: string, actor: SessionUser): Promise<void> {
  const children = await tx.issueLink.findMany({
    where: { parentId: parentIssueId, kind: "CREATED", unlinkedAt: null, child: { ownerId: { not: newOwnerId } } },
    select: { child: { select: { id: true, number: true, entityId: true, ownerId: true } } },
  });
  if (children.length === 0) return;
  const t = now();
  // One query for the prior owners' names, one update for every child, one insert each for audit and History (not per child).
  const priorIds = [...new Set(children.map(({ child }) => child.ownerId).filter((id): id is string => !!id))];
  const prior = priorIds.length > 0 ? await tx.user.findMany({ where: { id: { in: priorIds } }, select: { id: true, name: true } }) : [];
  const priorName = new Map(prior.map((u) => [u.id, u.name]));
  await tx.issue.updateMany({ where: { id: { in: children.map(({ child }) => child.id) } }, data: { ownerId: newOwnerId, ownerSince: t } });

  const withAction = children.map(({ child }) => ({ child, actionId: randomUUID() }));
  await recordFieldsMany(
    tx,
    withAction.map(({ child, actionId }) => ({
      actionId,
      entityId: child.entityId,
      objectType: "ISSUE" as const,
      objectId: child.id,
      objectLabel: `Issue: ${issueDisplayId(child.number)}`,
      fields: [{ field: "Owner", oldValue: (child.ownerId && priorName.get(child.ownerId)) || null, newValue: newOwnerName }],
      actor: { userId: actor.id, userName: actor.name, userTeam: actor.team },
      createdAt: t,
    })),
  );
  await addHistoryMany(
    tx,
    withAction.map(({ child, actionId }) => ({
      entityId: child.entityId,
      category: "INCIDENT" as const,
      summary: `${issueDisplayId(child.number)} owner changed to ${newOwnerName}: follows partner issue's owner`,
      actionId,
      issueId: child.id,
      actorId: actor.id,
      actorName: actor.name,
      actorTeam: actor.team,
      createdAt: t,
    })),
  );
}

/** Brief M21 AC1, M23 AC7. Active CREATED children in New move to In progress when the parent is acknowledged -- no acknowledge clock of their own. */
export async function syncCreatedChildrenAcknowledged(tx: Prisma.TransactionClient, parentIssueId: string, parentNumber: number): Promise<void> {
  const children = await tx.issueLink.findMany({
    where: { parentId: parentIssueId, kind: "CREATED", unlinkedAt: null, child: { status: "NEW" } },
    select: { child: { select: { id: true, number: true, entityId: true } } },
  });
  if (children.length === 0) return;
  const t = now();
  await tx.issue.updateMany({ where: { id: { in: children.map(({ child }) => child.id) } }, data: { status: "IN_PROGRESS" } });
  const withAction = children.map(({ child }) => ({ child, actionId: randomUUID() }));
  await recordFieldsMany(
    tx,
    withAction.map(({ child, actionId }) => ({
      actionId,
      entityId: child.entityId,
      objectType: "ISSUE" as const,
      objectId: child.id,
      objectLabel: `Issue: ${issueDisplayId(child.number)}`,
      fields: [{ field: "Status", oldValue: "New", newValue: "In progress" }],
      actor: { userId: null, userName: "Customer Hub", userTeam: null },
      source: "SYSTEM_ISSUE" as const,
      createdAt: t,
    })),
  );
  await addHistoryMany(
    tx,
    withAction.map(({ child, actionId }) => ({
      entityId: child.entityId,
      category: "INCIDENT" as const,
      summary: `${issueDisplayId(child.number)} moved to In progress: partner issue ${issueDisplayId(parentNumber)} was acknowledged`,
      actionId,
      issueId: child.id,
      actorName: "Customer Hub",
      createdAt: t,
    })),
  );
}
