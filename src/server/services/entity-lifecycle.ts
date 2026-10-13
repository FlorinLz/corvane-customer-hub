import { updateFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { findLeiConflictMessage } from "@/server/queries/deleted-records";

/** Brief 4.8.1, M16 AC8-AC10. Admin only; reason 10 to 500 chars (4. "Shared conventions", reason lengths). */
export async function softDeleteEntity(user: SessionUser, entityId: string, reason: string) {
  assertCan(user, "entity.softDelete");
  if (reason.length < 10 || reason.length > 500) {
    throw new ValidationError({ reason: ["Enter a reason of 10 to 500 characters"] });
  }

  return mutate(user, { entityId }, async (tx, log, t) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.softDelete", { entity: { deletedAt: entity.deletedAt } });
    if (entity.deletedAt) throw new ConflictError("already_deleted");

    const deletedAt = t; // the demo-clock instant of this transaction
    await tx.entity.update({
      where: { id: entityId },
      data: { deletedAt, deletedById: user.id, deleteReason: reason },
    });
    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Record status",
      fields: updateFields({ "Record status": "Active" }, { "Record status": "Deleted" }),
      reason,
    });
    await log.history({
      category: "NETWORK_AND_STRUCTURE",
      summary: `Record status: Active → Deleted. Reason: ${reason}`,
    });
    return { ...entity, deletedAt, deletedById: user.id, deleteReason: reason };
  });
}

/** Brief 4.8.2, M16 AC12, AC13, resolution 57. Admin only; guard 5 (7.6.9 #5) blocks reactivation when another active entity holds the same LEI — the R1 substitute for the full M16 AC15 reused-LEI flow (R2). */
export async function reactivateEntity(user: SessionUser, entityId: string) {
  assertCan(user, "entity.reactivate");

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    if (!entity.deletedAt) throw new ConflictError("not_deleted");

    if (entity.lei) {
      const blockedMessage = await findLeiConflictMessage(entity.lei, entityId);
      if (blockedMessage) throw new ConflictError(blockedMessage);
    }

    await tx.entity.update({
      where: { id: entityId },
      data: { deletedAt: null, deletedById: null, deleteReason: null },
    });
    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Record status",
      fields: updateFields({ "Record status": "Deleted" }, { "Record status": "Active" }),
    });
    await log.history({
      category: "NETWORK_AND_STRUCTURE",
      summary: "Record status: Deleted → Active",
    });
    return { ...entity, deletedAt: null, deletedById: null, deleteReason: null };
  });
}
