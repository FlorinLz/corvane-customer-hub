import { createFields, updateFields } from "@/server/audit/record";
import { auditDate } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { today } from "@/lib/dates";
import { approvedDocHosts, checkDocLink, docLinkError } from "@/lib/validation/url";
import type { AttachContractInput } from "@/lib/validation/contract";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/** Brief 3.8.2 "Attach or replace contract", M4 AC9, AC10, AC13, AC14, D1. Ops; M5 R1 scope is a new entity contract only (no linking an existing group master agreement). */
export async function attachContract(user: SessionUser, entityId: string, input: AttachContractInput, expectedVersion: number) {
  assertCan(user, "entity.contract.attach");

  if (input.signingDate > today()) {
    throw new ValidationError({ signingDate: ["Signing date cannot be in the future"] });
  }
  const linkCheck = checkDocLink(input.documentUrl, approvedDocHosts());
  if (linkCheck !== "ok") {
    throw new ValidationError({ documentUrl: [docLinkError(linkCheck)!] });
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({
      where: { id: entityId },
      include: { customerRole: true },
    });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.contract.attach", { entity: { deletedAt: entity.deletedAt } });
    if (!entity.customerRole) {
      throw new ValidationError({ contractId: ["This entity has no customer role to attach a contract to"] });
    }
    if (entity.customerRole.version !== expectedVersion) {
      throw new ConflictError(await versionConflictMessage(tx, "CUSTOMER_ROLE", entity.customerRole.id, "customer role"));
    }

    const invoicedEntity = await tx.entity.findFirst({
      where: {
        id: input.invoicedEntityId,
        deletedAt: null,
        OR: [{ id: entityId }, { groupId: entity.groupId ?? "__none__" }],
      },
    });
    if (!invoicedEntity) {
      throw new ValidationError({ invoicedEntityId: ["Choose this entity or another entity in its group"] });
    }

    const existing = await tx.contract.findFirst({
      where: { contractId: { equals: input.contractId, mode: "insensitive" } },
    });
    if (existing) {
      throw new ValidationError({ contractId: ["A contract with this ID already exists"] });
    }

    const oldContractId = entity.customerRole.contractId;

    const contract = await tx.contract.create({
      data: {
        contractId: input.contractId,
        kind: "CUSTOMER_CONTRACT",
        title: input.title,
        signingDate: new Date(input.signingDate),
        scope: "ENTITY_CONTRACT",
        documentUrl: input.documentUrl,
        holderEntityId: entityId,
        invoicedEntityId: input.invoicedEntityId,
      },
    });

    await tx.customerRole.update({
      where: { entityId },
      data: { contractId: contract.id, version: { increment: 1 } },
    });

    await log.change({
      objectType: "CONTRACT",
      objectId: contract.id,
      objectLabel: `Contract: ${contract.contractId}`,
      fields: createFields({
        "Contract ID": contract.contractId,
        Title: contract.title,
        "Signing date": auditDate(input.signingDate),
        Scope: "Entity contract",
        "Document link": contract.documentUrl,
      }),
    });
    await log.change({
      objectType: "CUSTOMER_ROLE",
      objectId: entity.customerRole.id,
      objectLabel: "Customer role",
      fields: updateFields({ "Contract reference": oldContractId }, { "Contract reference": contract.contractId }),
    });
    await log.history({ category: "OTHER_FIELD_CHANGES", summary: `Contract ${contract.contractId} attached` });

    return contract;
  });
}
