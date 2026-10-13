import { cache } from "react";

import { db } from "@/server/db";
import { today as todayFn, toLocalDate } from "@/lib/dates";
import { computeAlerts, type Alert } from "@/server/derived/alerts";
import { computeBillingFlag } from "@/server/derived/billing-flag";
import { computeCoverageStatus } from "@/server/derived/coverage-status";
import { computeKybStatus } from "@/server/derived/kyb-status";
import { computeReviewStatus } from "@/server/derived/review-status";
import { loadEntityCore } from "@/server/queries/entity-core";
import { CONTACT_ROLE_ORDER } from "@/lib/labels";
import type { ContactRole } from "@prisma/client";

export const loadOverviewData = cache(async (id: string) => {
  const entity = await loadEntityCore(id);
  if (!entity) return null;

  const today = todayFn();

  const [
    products,
    customerRole,
    partnerRole,
    contacts,
    kybChecks,
    periodicReview,
    billingProfile,
    historyEvents,
    notes,
    groupSiblings,
  ] = await Promise.all([
    db.contractedProduct.findMany({
      where: { entityId: id, cancelledAt: null },
      include: { contractingEntity: { select: { legalName: true } } },
      orderBy: { targetGoLive: "asc" },
    }),
    entity.customerRole?.active
      ? db.customerRole.findUnique({
          where: { entityId: id },
          include: { contract: { select: { contractId: true, title: true, scope: true, invoicedEntityId: true, invoicedEntity: { select: { legalName: true } } } } },
        })
      : null,
    entity.partnerRole?.active
      ? db.partnerRole.findUnique({
          where: { entityId: id },
          include: {
            partnerAgreement: { select: { contractId: true } },
            coverage: { include: { statusChanges: { select: { status: true, effectiveDate: true, createdAt: true } } } },
          },
        })
      : null,
    db.contact.findMany({ where: { entityId: id, status: "ACTIVE" } }),
    db.kybCheck.findMany({ where: { entityId: id } }),
    db.periodicReview.findUnique({ where: { entityId: id } }),
    db.billingProfile.findUnique({ where: { entityId: id } }),
    db.historyEvent.findMany({
      where: { entityId: id, category: { not: "OTHER_FIELD_CHANGES" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.note.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
    entity.groupId
      ? db.entity.findMany({
          where: { groupId: entity.groupId, id: { not: id }, deletedAt: null },
          select: { id: true, legalName: true, country: true, lei: true, customerRole: { select: { active: true } }, partnerRole: { select: { active: true } } },
        })
      : Promise.resolve([]),
  ]);

  // ---- Alerts input ----
  const blockedProducts = products
    .filter((p) => p.blockedBy)
    .map((p) => ({
      label: `${p.product === "EU_VOP" ? "EU VoP" : p.product === "UK_COP" ? "UK CoP" : "Global validation"} / ${p.country}`,
      blockedBy: p.blockedBy!,
      since: toLocalDate(p.blockedSince!),
      reason: p.blockedReason ?? "",
    }));

  const overdueGoLives = products
    .filter((p) => toLocalDate(p.targetGoLive) < today && p.stage !== "LIVE_HYPERCARE" && p.stage !== "RAMP_UP" && p.stage !== "BAU")
    .map((p) => ({
      label: `${p.product === "EU_VOP" ? "EU VoP" : p.product === "UK_COP" ? "UK CoP" : "Global validation"} / ${p.country}`,
      targetGoLive: toLocalDate(p.targetGoLive),
    }));

  const kybExpired: string[] = [];
  const kybExpiring: { label: string; expiryDate: string }[] = [];
  const KYB_LABEL: Record<string, string> = { LICENCE: "Licence", LEI: "LEI", OWNERSHIP_STRUCTURE: "Ownership structure", SANCTIONS_SCREENING: "Sanctions screening" };
  for (const k of kybChecks) {
    const status = computeKybStatus({
      type: k.type,
      verifiedOn: k.verifiedOn ? toLocalDate(k.verifiedOn) : null,
      expiryDate: k.expiryDate ? toLocalDate(k.expiryDate) : null,
      noExpiry: k.noExpiry,
      entityLeiStatus: entity.leiStatus,
      entityGleifRawStatus: entity.gleifRawStatus,
      entityLeiNextRenewalDate: entity.leiNextRenewalDate ? toLocalDate(entity.leiNextRenewalDate) : null,
      today,
    });
    if (status === "EXPIRED") kybExpired.push(KYB_LABEL[k.type]);
    if (status === "EXPIRING") {
      const expiry = k.type === "LEI" ? entity.leiNextRenewalDate : k.expiryDate;
      if (expiry) kybExpiring.push({ label: KYB_LABEL[k.type], expiryDate: toLocalDate(expiry) });
    }
  }

  const invoicedEntityId = customerRole?.contract?.invoicedEntityId ?? null;
  const isOwnInvoicedEntity = invoicedEntityId === null || invoicedEntityId === id;
  const billingFlag = computeBillingFlag({
    hasActiveCustomerRole: entity.customerRole?.active ?? false,
    lifecycle: entity.lifecycleState,
    isDeleted: entity.deletedAt !== null,
    isOwnInvoicedEntity,
    billedThroughEntityName: customerRole?.contract?.invoicedEntity?.legalName ?? null,
    hasPartnerRole: entity.partnerRole?.active ?? false,
    contractReference: customerRole?.contract?.contractId ?? null,
    profile: billingProfile
      ? { billingLegalName: billingProfile.billingLegalName, street: billingProfile.street, city: billingProfile.city, postalCode: billingProfile.postalCode, country: billingProfile.country, vatId: billingProfile.vatId, lei: billingProfile.lei, contractingEntity: billingProfile.contractingEntity }
      : null,
  });

  const reviewStatus = periodicReview
    ? computeReviewStatus({ storedStatus: periodicReview.status, nextReviewDate: toLocalDate(periodicReview.nextReviewDate), today })
    : null;

  const sanctionsCheck = kybChecks.find((k) => k.type === "SANCTIONS_SCREENING");
  const sanctionsFlagged =
    sanctionsCheck?.sanctionsResult === "POTENTIAL_MATCH_UNDER_REVIEW" || sanctionsCheck?.sanctionsResult === "CONFIRMED_MATCH"
      ? sanctionsCheck.sanctionsResult
      : null;

  const coverageIssues: { label: string; status: "DEGRADED" | "SUSPENDED"; since: string }[] = [];
  let coverageCounts: Record<string, number> | null = null;
  if (partnerRole) {
    coverageCounts = {};
    for (const row of partnerRole.coverage) {
      const result = computeCoverageStatus(
        row.statusChanges.map((c) => ({ status: c.status, effectiveDate: toLocalDate(c.effectiveDate), createdAt: c.createdAt })),
        today,
      );
      if (!result.current) continue;
      coverageCounts[result.current.status] = (coverageCounts[result.current.status] ?? 0) + 1;
      if (result.current.status === "DEGRADED" || result.current.status === "SUSPENDED") {
        coverageIssues.push({ label: `${row.country} / ${row.scheme === "EU_VOP" ? "EU VoP" : row.scheme === "UK_COP" ? "UK CoP" : "Global validation"}`, status: result.current.status, since: result.current.effectiveDate });
      }
    }
  }

  const championContact = contacts.find((c) => c.context === "CUSTOMER" && c.role === "CHAMPION");
  const incidentContact = contacts.find((c) => c.context === (entity.partnerRole?.active ? "PARTNER" : "CUSTOMER") && c.role === "INCIDENT");

  const lastLeftChampion = !championContact
    ? await db.contact.findFirst({ where: { entityId: id, context: "CUSTOMER", role: "CHAMPION", status: "LEFT" }, orderBy: { leftOn: "desc" } })
    : null;

  const alerts: Alert[] = computeAlerts({
    today,
    blockedProducts,
    hasPartnerRole: entity.partnerRole?.active ?? false,
    hasActiveIncidentContact: entity.partnerRole?.active ? !!incidentContact : true,
    leiInvalid: entity.leiStatus ? ["LAPSED", "RETIRED", "MERGED", "ANNULLED", "DUPLICATE"].includes(entity.leiStatus) : false,
    kybExpired,
    kybExpiring,
    billingIncomplete: billingFlag.incomplete,
    billingMissingCount: billingFlag.missingFields.length + billingFlag.invalidFields.length,
    renewalDate: customerRole?.renewalDate ? toLocalDate(customerRole.renewalDate) : null,
    overdueGoLives,
    sanctionsFlagged,
    reviewOverdue: reviewStatus === "OVERDUE",
    reviewOverdueSince: periodicReview ? toLocalDate(periodicReview.nextReviewDate) : null,
    coverageIssues,
    hasActiveChampion: !!championContact,
    championLeftSince: lastLeftChampion?.leftOn ? toLocalDate(lastLeftChampion.leftOn) : null,
  });

  // ---- Key people ----
  const keyPeopleRows = CONTACT_ROLE_ORDER.map((role: ContactRole) => ({
    role,
    customer: contacts.find((c) => c.context === "CUSTOMER" && c.role === role) ?? null,
    partner: contacts.find((c) => c.context === "PARTNER" && c.role === role) ?? null,
  }));

  // ---- Latest interactions (merge notes + events) ----
  const interactions = [
    ...historyEvents.map((e) => ({ kind: "event" as const, id: e.id, date: e.createdAt, actorName: e.actorName, actorTeam: e.actorTeam, summary: e.summary, details: e.details })),
    ...notes.map((n) => ({ kind: "note" as const, id: n.id, date: n.createdAt, actorName: null, actorTeam: n.authorTeam, summary: n.summary, type: n.type })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  return {
    entity,
    alerts,
    products,
    customerRole,
    partnerRole,
    coverageCounts,
    contacts,
    keyPeopleRows,
    interactions,
    groupSiblings,
  };
});

export type OverviewData = NonNullable<Awaited<ReturnType<typeof loadOverviewData>>>;
