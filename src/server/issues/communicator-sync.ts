import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { now } from "@/lib/dates";
import { recordFieldsMany } from "@/server/audit/record";
import { addHistoryMany } from "@/server/audit/history";
import { issueDisplayId } from "@/lib/labels";
import type { SessionUser } from "@/server/permissions/can";

/**
 * Brief 4.9.7 "Customer owner changes" (M18 AC7, M22 AC1). Call in the
 * same transaction as the write that just set `Entity.ownerId` to
 * `newOwnerId` -- today only `reassignOwner()` (M9); a handoff-accept
 * flow (Sales -> Ops, Ops -> CS) will add its own call in milestone 7.
 * Only issues whose communicator currently follows the customer owner
 * (`communicatorRule = CUSTOMER_OWNER`) get an entry: issues still in
 * their hand-over interim (`ISSUE_OWNER_UNTIL_HANDOVER`) are untouched
 * here and simply hand over to the new owner when `handoverAt` passes
 * (ensureSystemWrites() reads `Entity.ownerId` at that moment).
 *
 * The communication-log entry and the issue note are system-flavoured
 * (`kind`/`type` SYSTEM, actor "Customer Hub", per the schema's own
 * enum comments), but the audit entry and History event attribute to
 * the human who changed the owner (default `source` USER) -- this is
 * their own consequence, not an unattended system write like the
 * hand-over (4.9.11: "source SYSTEM_ISSUE for the hand-over" implies
 * the plain "Communicator change" row is not). See DECISIONS.md.
 */
export async function onCustomerOwnerChanged(
  tx: Prisma.TransactionClient,
  entityId: string,
  oldOwnerId: string | null,
  newOwnerId: string,
  actor: SessionUser,
): Promise<void> {
  const [newOwner, oldOwner] = await Promise.all([
    tx.user.findUnique({ where: { id: newOwnerId }, select: { name: true } }),
    oldOwnerId ? tx.user.findUnique({ where: { id: oldOwnerId }, select: { name: true } }) : Promise.resolve(null),
  ]);
  if (!newOwner) return;

  const issues = await tx.issue.findMany({
    where: { entityId, status: { not: "CLOSED" }, communicatorRule: "CUSTOMER_OWNER" },
    select: { id: true, number: true },
  });
  if (issues.length === 0) return;

  const t = now();
  const text = `Communicator changed to ${newOwner.name}: customer owner changed`;

  // One insert per kind of row for every open customer-owner issue, not four statements per issue.
  const withAction = issues.map((issue) => ({ issue, actionId: randomUUID() }));
  await tx.issueCommunication.createMany({
    data: issues.map((issue) => ({ issueId: issue.id, type: "SYSTEM" as const, occurredAt: t, message: text, recordedByName: "Customer Hub", createdAt: t })),
  });
  await tx.issueNote.createMany({
    data: issues.map((issue) => ({ issueId: issue.id, kind: "SYSTEM" as const, body: text, authorName: "Customer Hub", createdAt: t })),
  });
  await recordFieldsMany(
    tx,
    withAction.map(({ issue, actionId }) => ({
      actionId,
      entityId,
      objectType: "ISSUE" as const,
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: "Communicator", oldValue: oldOwner?.name ?? null, newValue: newOwner.name }],
      actor: { userId: actor.id, userName: actor.name, userTeam: actor.team },
      createdAt: t,
    })),
  );
  await addHistoryMany(
    tx,
    withAction.map(({ issue, actionId }) => ({
      entityId,
      category: "INCIDENT" as const,
      summary: `${issueDisplayId(issue.number)}: communicator changed to ${newOwner.name} (customer owner changed)`,
      actionId,
      issueId: issue.id,
      actorId: actor.id,
      actorName: actor.name,
      actorTeam: actor.team,
      createdAt: t,
    })),
  );
}
