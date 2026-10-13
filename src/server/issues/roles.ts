import type { Prisma } from "@prisma/client";

import { now } from "@/lib/dates";
import { effectiveTimeZone, formatInZone } from "@/lib/time-zones";
import { effectiveCommunicator, type CommunicatorIssue } from "@/server/derived/communicator";
import { NotFoundError, IssueForbiddenError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { Action, SessionUser } from "@/server/permissions/can";
import { db } from "@/server/db";

// Brief 4.9.12 `issueRoles()`. 6A inlined the owner check directly in
// issue.ts (`assertIsOwner`, M19 AC19); this module factors it out so
// 6B's communicator actions (issue-communication.ts) share the same
// "find the issue's entity, check it isn't soft-deleted" preamble
// instead of duplicating it across two service files.

/** Every issue-write service's first DB call: resolve the entity (for `assertCan`'s deleted-entity gate and `mutate()`'s audit scope) before opening its own transaction. */
export async function requireIssueEntity(issueId: string, user: SessionUser, action: Action): Promise<{ entityId: string }> {
  const issue = await db.issue.findUnique({ where: { id: issueId }, select: { entityId: true, entity: { select: { deletedAt: true } } } });
  if (!issue) throw new NotFoundError();
  assertCan(user, action, { entity: { deletedAt: issue.entity.deletedAt } });
  return { entityId: issue.entityId };
}

/** Brief M19 AC19, M21 AC11: only the current owner. */
export async function assertIsOwner<T extends { ownerId: string | null }>(tx: Prisma.TransactionClient, issue: T, user: SessionUser): Promise<void> {
  if (issue.ownerId === user.id) return;
  const owner = issue.ownerId ? await tx.user.findUnique({ where: { id: issue.ownerId }, select: { name: true } }) : null;
  throw new IssueForbiddenError("not_issue_owner", owner ? `Only the owner, ${owner.name}, can change this issue` : "Only the owner can change this issue");
}

/**
 * Brief M22 AC18, edge case 4. Only the effective communicator at
 * request time; a stale owner caught just after the hand-over gets
 * `communication_handed_over` instead of the generic `not_communicator`.
 */
export async function assertIsCommunicator(
  tx: Prisma.TransactionClient,
  issue: CommunicatorIssue & { entityId: string },
  user: SessionUser,
): Promise<void> {
  const entity = await tx.entity.findUnique({ where: { id: issue.entityId }, select: { ownerId: true } });
  const t = now();
  const communicatorId = effectiveCommunicator(issue, { ownerId: entity?.ownerId ?? null }, t);
  if (communicatorId === user.id) return;

  if (issue.communicatorRule === "ISSUE_OWNER_UNTIL_HANDOVER" && issue.ownerId === user.id && issue.handoverAt && t >= issue.handoverAt) {
    const [newCommunicator, requester] = await Promise.all([
      entity?.ownerId ? tx.user.findUnique({ where: { id: entity.ownerId }, select: { name: true } }) : Promise.resolve(null),
      tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } }),
    ]);
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    throw new IssueForbiddenError(
      "communication_handed_over",
      `Communication passed to ${newCommunicator?.name ?? "the customer owner"} at ${formatInZone(issue.handoverAt, zone)}. Ask them to record this, or add it as a note.`,
    );
  }

  const communicator = communicatorId ? await tx.user.findUnique({ where: { id: communicatorId }, select: { name: true } }) : null;
  throw new IssueForbiddenError("not_communicator", communicator ? `Only the communicator, ${communicator.name}, can do this` : "No communicator is set for this issue");
}
