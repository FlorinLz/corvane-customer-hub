import { updateFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/**
 * Brief 3.8.2 "Set group" (the "Link entity" half), M4 AC3, AC13, AC14.
 * Ops; M5 R1 scope links a currently standalone (or group-not-set) entity
 * only — moving an already-grouped entity (confirmMove, M4 AC4) is R2.
 */
export async function linkEntityToGroup(user: SessionUser, entityId: string, groupId: string, expectedVersion: number) {
  assertCan(user, "entity.group.edit");

  return mutate(user, { entityId, groupId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.group.edit", { entity: { deletedAt: entity.deletedAt } });

    if (entity.groupId) {
      throw new ConflictError("Moving between groups isn't available in this release.");
    }
    if (entity.version !== expectedVersion) {
      throw new ConflictError(await versionConflictMessage(tx, "LEGAL_ENTITY", entityId, "record"));
    }

    const group = await tx.group.findUnique({ where: { id: groupId } });
    if (!group) throw new ValidationError({ groupId: ["Select a group"] });

    await tx.entity.update({
      where: { id: entityId },
      data: { groupId, groupDecision: "GROUP", version: { increment: 1 } },
    });

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Group",
      fields: updateFields({ Group: null }, { Group: group.name }),
    });
    await log.history({ category: "NETWORK_AND_STRUCTURE", summary: `Linked to group ${group.name}` });

    return { ...entity, groupId, groupDecision: "GROUP" as const };
  });
}

/** Brief 3.8.2 "Unlink entity", M4 AC5, AC13. Ops; roles, contracts and products are unchanged. */
export async function unlinkEntityFromGroup(user: SessionUser, groupId: string, entityId: string, expectedVersion: number) {
  assertCan(user, "entity.group.edit");

  return mutate(user, { entityId, groupId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId }, include: { group: { select: { name: true } } } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.group.edit", { entity: { deletedAt: entity.deletedAt } });
    if (entity.groupId !== groupId) throw new NotFoundError();
    if (entity.version !== expectedVersion) {
      throw new ConflictError(await versionConflictMessage(tx, "LEGAL_ENTITY", entityId, "record"));
    }

    const groupName = entity.group?.name ?? "its group";

    await tx.entity.update({
      where: { id: entityId },
      data: { groupId: null, groupDecision: "STANDALONE", version: { increment: 1 } },
    });

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Group",
      fields: updateFields({ Group: groupName }, { Group: "Standalone entity" }),
    });
    await log.history({ category: "NETWORK_AND_STRUCTURE", summary: `Unlinked from group ${groupName}` });

    return { ...entity, groupId: null, groupDecision: "STANDALONE" as const };
  });
}
