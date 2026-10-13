import { updateFields } from "@/server/audit/record";
import { auditDate } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { today } from "@/lib/dates";
import type { RenewalDateInput } from "@/lib/validation/renewal-date";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/** Brief 3.8.2 "Renewal date", S4.9, M15 AC3, M11 AC11. CS. */
export async function setRenewalDate(user: SessionUser, entityId: string, input: RenewalDateInput) {
  assertCan(user, "customer.renewalDate.edit");

  if (input.renewalDate < today()) {
    throw new ValidationError({ renewalDate: ["Renewal date cannot be in the past"] });
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId }, include: { customerRole: true } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "customer.renewalDate.edit", { entity: { deletedAt: entity.deletedAt } });
    if (!entity.customerRole) {
      throw new ValidationError({ renewalDate: ["This entity has no customer role"] });
    }
    if (entity.customerRole.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CUSTOMER_ROLE", entity.customerRole.id, "customer role"));
    }

    const oldValue = auditDate(entity.customerRole.renewalDate);

    await tx.customerRole.update({
      where: { entityId },
      data: { renewalDate: new Date(input.renewalDate), version: { increment: 1 } },
    });

    await log.change({
      objectType: "CUSTOMER_ROLE",
      objectId: entity.customerRole.id,
      objectLabel: "Customer role",
      fields: updateFields({ "Renewal date": oldValue }, { "Renewal date": auditDate(input.renewalDate) }),
      reason: input.note,
    });
    await log.history({ category: "OTHER_FIELD_CHANGES", summary: `Renewal date changed to ${auditDate(input.renewalDate)}` });

    return entity.customerRole;
  });
}
