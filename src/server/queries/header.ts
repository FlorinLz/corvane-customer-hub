import { cache } from "react";

import { db } from "@/server/db";
import { now as nowFn, today as todayFn } from "@/lib/dates";
import { computeAvailability } from "@/server/derived/availability";
import { computeBillingFlag } from "@/server/derived/billing-flag";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { loadEntityCore } from "@/server/queries/entity-core";

export const loadHeaderData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const today = todayFn();

  const [incidentContact, pendingHandoffs, coverageRows, customerRoleDetail, openIssueCount, eligibleForOpsToCs] = await Promise.all([
    entity.partnerRole?.active
      ? db.contact.findFirst({
          where: { entityId: id, context: "PARTNER", role: "INCIDENT", status: "ACTIVE" },
          orderBy: [{ isPrimary: "desc" }, { lastVerifiedAt: "desc" }],
          include: { lastVerifiedBy: { select: { name: true } } },
        })
      : null,
    db.handoff.findMany({
      where: { entityId: id, status: "SENT" },
      include: { fromUser: { select: { name: true } }, toUser: { select: { name: true, team: true } } },
    }),
    entity.partnerRole?.active
      ? db.partnerCoverage.findMany({
          where: { partnerRole: { entityId: id } },
          include: { statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } } },
        })
      : Promise.resolve([]),
    entity.customerRole?.active
      ? db.customerRole.findUnique({
          where: { entityId: id },
          select: { contract: { select: { contractId: true, invoicedEntityId: true, invoicedEntity: { select: { legalName: true } } } } },
        })
      : null,
    // Brief B conventions: open = every status except Closed.
    db.issue.count({ where: { entityId: id, status: { not: "CLOSED" } } }),
    // M8 AC1: "Hand over to Customer Success" is available once at least one customer product has completed hypercare.
    entity.customerRole?.active
      ? db.contractedProduct.findFirst({ where: { entityId: id, cancelledAt: null, stage: { in: ["RAMP_UP", "BAU"] } }, select: { id: true } })
      : null,
  ]);

  const billingProfile = await db.billingProfile.findUnique({ where: { entityId: id } });
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

  const hasCoverageIssue = coverageRows.some((row) => {
    const status = computeCoverageStatus(
      row.statusChanges.map((c) => ({ status: c.status, effectiveDate: c.effectiveDate.toISOString().slice(0, 10), createdAt: c.createdAt })),
      today,
    ).current?.status;
    return status === "DEGRADED" || status === "SUSPENDED";
  });

  const now = nowFn();
  const incident = incidentContact
    ? {
        name: incidentContact.fullName,
        jobTitle: incidentContact.jobTitle,
        phone: incidentContact.phone,
        email: incidentContact.email,
        timeZone: incidentContact.timeZone,
        isPrimary: incidentContact.isPrimary,
        available24x7: incidentContact.available24x7,
        lastVerifiedAt: incidentContact.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
        lastVerifiedByName: incidentContact.lastVerifiedBy?.name ?? null,
        availability: incidentContact.timeZone
          ? computeAvailability({
              timeZone: incidentContact.timeZone,
              available24x7: incidentContact.available24x7,
              availabilityDays: incidentContact.availabilityDays,
              availabilityStart: incidentContact.availabilityStart,
              availabilityEnd: incidentContact.availabilityEnd,
              now,
            })
          : null,
      }
    : null;

  const salesToOps = pendingHandoffs.find((h) => h.type === "SALES_TO_OPS");
  const opsToCs = pendingHandoffs.find((h) => h.type === "OPS_TO_CS");

  return {
    entity,
    incident,
    hasCoverageIssue,
    billingFlag,
    openIssueCount,
    hasEligibleProductForOpsToCs: !!eligibleForOpsToCs,
    pendingHandoffs: {
      salesToOps: salesToOps
        ? { id: salesToOps.id, recipient: salesToOps.toUser.name, sentAt: salesToOps.sentAt.toISOString().slice(0, 10) }
        : null,
      opsToCs: opsToCs
        ? { id: opsToCs.id, recipient: opsToCs.toUser.name, sentAt: opsToCs.sentAt.toISOString().slice(0, 10) }
        : null,
    },
  };
});

export type HeaderData = NonNullable<Awaited<ReturnType<typeof loadHeaderData>>>;
