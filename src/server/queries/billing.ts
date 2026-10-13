import { cache } from "react";

import { db } from "@/server/db";
import { computeBillingFlag } from "@/server/derived/billing-flag";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadBillingData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const [customerRoleDetail, billingProfile, billingContacts] = await Promise.all([
    entity.customerRole?.active
      ? db.customerRole.findUnique({
          where: { entityId: id },
          include: { contract: { include: { invoicedEntity: { select: { id: true, legalName: true } } } } },
        })
      : null,
    db.billingProfile.findUnique({ where: { entityId: id } }),
    db.contact.findMany({ where: { entityId: id, role: "BILLING", status: "ACTIVE" }, include: { lastVerifiedBy: { select: { name: true } } } }),
  ]);

  const invoicedEntityId = customerRoleDetail?.contract?.invoicedEntityId ?? null;
  const isOwnInvoicedEntity = invoicedEntityId === null || invoicedEntityId === id;

  const billingFlag = computeBillingFlag({
    hasActiveCustomerRole: entity.customerRole?.active ?? false,
    lifecycle: entity.lifecycleState,
    isDeleted: entity.deletedAt !== null,
    isOwnInvoicedEntity,
    billedThroughEntityName: customerRoleDetail?.contract?.invoicedEntity?.legalName ?? null,
    hasPartnerRole: entity.partnerRole?.active ?? false,
    contractReference: customerRoleDetail?.contract?.contractId ?? null,
    profile: billingProfile
      ? {
          billingLegalName: billingProfile.billingLegalName,
          street: billingProfile.street,
          city: billingProfile.city,
          postalCode: billingProfile.postalCode,
          country: billingProfile.country,
          vatId: billingProfile.vatId,
          lei: billingProfile.lei,
          contractingEntity: billingProfile.contractingEntity,
        }
      : null,
  });

  return { entity, contract: customerRoleDetail?.contract ?? null, billingProfile, billingContacts, billingFlag };
});

export type BillingData = NonNullable<Awaited<ReturnType<typeof loadBillingData>>>;
