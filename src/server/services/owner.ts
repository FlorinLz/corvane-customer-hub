import { updateFields } from "@/server/audit/record";
import { now, today } from "@/lib/dates";
import { formatDateTime } from "@/lib/time-zones";
import { mutate } from "@/server/audit/mutate";
import type { ReassignOwnerInput } from "@/lib/validation/owner";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { onCustomerOwnerChanged } from "@/server/issues/communicator-sync";
import { db } from "@/server/db";

/** Brief 3.8.2 "Reassign owner", M9 AC3-AC11, edge 1, edge 3, edge 4. CS. */
export async function reassignOwner(user: SessionUser, entityId: string, input: ReassignOwnerInput) {
  assertCan(user, "owner.reassign");

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId }, include: { owner: { select: { id: true, name: true } } } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "owner.reassign", { entity: { deletedAt: entity.deletedAt } });

    if ((entity.ownerId ?? null) !== (input.expectedOwnerId ?? null)) {
      const last = await tx.auditEntry.findFirst({
        where: { entityId, objectType: "LEGAL_ENTITY", field: "Owner" },
        orderBy: { createdAt: "desc" },
      });
      const who = last ? `${last.userName} at ${formatDateTime(last.createdAt)}` : "someone else";
      throw new ConflictError(`Owner was changed by ${who}. Reload to see the current owner.`);
    }
    if (input.newOwnerId === entity.ownerId) {
      throw new ValidationError({ newOwnerId: ["Select a different owner"] });
    }

    const newOwner = await tx.user.findUnique({ where: { id: input.newOwnerId } });
    if (!newOwner || !newOwner.active || !["CS", "OPS", "SALES"].includes(newOwner.team)) {
      throw new ValidationError({ newOwnerId: ["Select a different owner"] });
    }

    const t = now();
    await tx.ownerAssignment.updateMany({
      where: { entityId, acknowledgedAt: null, supersededAt: null },
      data: { supersededAt: t },
    });

    if (newOwner.id !== user.id) {
      await tx.ownerAssignment.create({
        data: { entityId, assigneeId: newOwner.id, assignedById: user.id, previousOwnerId: entity.ownerId, reason: input.reason, assignedAt: t },
      });
    }

    await tx.entity.update({ where: { id: entityId }, data: { ownerId: newOwner.id, ownerSince: t } });
    await onCustomerOwnerChanged(tx, entityId, entity.ownerId, newOwner.id, user);

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Owner",
      fields: updateFields({ Owner: entity.owner?.name ?? null }, { Owner: newOwner.name }),
      reason: input.reason,
    });
    await log.history({
      category: "OWNER_REASSIGNED",
      summary: `Owner reassigned from ${entity.owner?.name ?? "no owner"} to ${newOwner.name}. Reason: ${input.reason}`,
    });

    return { ownerId: newOwner.id, ownerName: newOwner.name, ownerSince: today() };
  });
}

/** Brief 3.8.2 "Acknowledge assignment", M9 AC10. The named assignee only — not a matrix area, so this checks identity directly rather than going through can(). */
export async function acknowledgeAssignment(user: SessionUser, assignmentId: string) {
  const assignment = await db.ownerAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new NotFoundError();
  if (assignment.assigneeId !== user.id) {
    throw new ForbiddenError("Customer Success");
  }
  if (assignment.supersededAt) {
    throw new ConflictError("This assignment was replaced by a later owner change.");
  }
  if (assignment.acknowledgedAt) {
    return assignment;
  }

  return mutate(user, { entityId: assignment.entityId }, async (tx, log) => {
    const updated = await tx.ownerAssignment.update({ where: { id: assignmentId }, data: { acknowledgedAt: now() } });
    await log.change({
      objectType: "OWNER_ASSIGNMENT",
      objectId: assignmentId,
      objectLabel: "Owner assignment",
      fields: updateFields({ Acknowledged: "No" }, { Acknowledged: "Yes" }),
    });
    return updated;
  });
}
