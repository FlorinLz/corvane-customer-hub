import { updateFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { recomputeLifecycle } from "@/server/services/lifecycle-recompute";
import type { SetRolesInput } from "@/lib/validation/roles";

/**
 * Brief 3.8.2 "Set roles", M4 AC7 (part), AC14. R1 is add-only: turning an
 * active role off is M4 AC8's R2 removal-with-confirmation flow, so a
 * request that asks to deactivate an already-active role is rejected
 * here rather than silently ignored.
 */
export async function setRoles(user: SessionUser, entityId: string, input: SetRolesInput) {
  assertCan(user, "entity.roles.edit");

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({
      where: { id: entityId },
      include: { customerRole: true, partnerRole: true },
    });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.roles.edit", { entity: { deletedAt: entity.deletedAt } });

    if ((entity.customerRole?.active && !input.customer) || (entity.partnerRole?.active && !input.partner)) {
      throw new ValidationError({ roles: ["Removing a role isn't available yet"] });
    }

    if (entity.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "LEGAL_ENTITY", entityId, "record"));
    }

    const addedLabels: string[] = [];

    if (input.customer && !entity.customerRole?.active) {
      if (entity.customerRole) {
        await tx.customerRole.update({ where: { entityId }, data: { active: true, version: { increment: 1 } } });
      } else {
        await tx.customerRole.create({ data: { entityId, active: true, createdById: user.id } });
      }
      addedLabels.push("Customer");
    }

    if (input.partner && !entity.partnerRole?.active) {
      if (entity.partnerRole) {
        await tx.partnerRole.update({ where: { entityId }, data: { active: true, version: { increment: 1 } } });
      } else {
        await tx.partnerRole.create({ data: { entityId, active: true } });
      }
      addedLabels.push("Network partner");
    }

    if (addedLabels.length === 0) return entity;

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "Roles",
      fields: updateFields(
        { Roles: [entity.customerRole?.active && "Customer", entity.partnerRole?.active && "Network partner"].filter(Boolean).join(", ") || null },
        { Roles: [input.customer && "Customer", input.partner && "Network partner"].filter(Boolean).join(", ") || null },
      ),
    });
    await log.histories(addedLabels.map((label) => ({ category: "NETWORK_AND_STRUCTURE" as const, summary: `Role added: ${label}` })));

    await recomputeLifecycle(tx, entityId);
    return entity;
  });
}
