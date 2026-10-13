import { createFields, updateFields } from "@/server/audit/record";
import { auditBoolean, auditDate, auditDecimal, auditEnum, auditText } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { approvedDocHosts, checkDocLink, docLinkError } from "@/lib/validation/url";
import { OBLIGATION_CARD_KIND_LABELS, REGULATORY_REGIME_LABELS, SCHEME_ADHERENCE_LABELS } from "@/lib/labels";
import type { ObligationsInput } from "@/lib/validation/obligations";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import type { ObligationCardKind } from "@prisma/client";

/** Brief 3.8.2 "Save obligations", M13 AC2-AC6, AC14. Compliance. M5 R1 implements the Customer agreement card. */
export async function saveObligations(user: SessionUser, entityId: string, kind: ObligationCardKind, input: ObligationsInput) {
  assertCan(user, "compliance.obligations.edit");

  if (input.contractUrl) {
    const check = checkDocLink(input.contractUrl, approvedDocHosts());
    if (check !== "ok") throw new ValidationError({ contractUrl: [docLinkError(check)!] });
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "compliance.obligations.edit", { entity: { deletedAt: entity.deletedAt } });

    const existing = await tx.obligationCard.findUnique({ where: { entityId_kind: { entityId, kind } } });
    if (existing && existing.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "OBLIGATIONS", existing.id, "obligations card"));
    }

    const isCustomerAgreement = kind === "CUSTOMER_AGREEMENT";

    const before = existing
      ? {
          "Incident notification time": existing.incidentNoticeHours !== null ? `${existing.incidentNoticeHours} hours` : null,
          "Subprocessor change notice": existing.subprocessorNoticeDays !== null ? `${existing.subprocessorNoticeDays} days` : null,
          "Audit right": auditBoolean(existing.auditRight),
          "Availability SLA": auditDecimal(existing.availabilitySlaPct),
          "EU VoP status": auditEnum(existing.euVopStatus, SCHEME_ADHERENCE_LABELS),
          "UK CoP status": auditEnum(existing.ukCopStatus, SCHEME_ADHERENCE_LABELS),
          "Agreement expiry date": auditDate(existing.expiryDate),
          "Contract PDF link": auditText(existing.contractUrl),
          ...(isCustomerAgreement
            ? {
                "Regulatory regime": auditEnum(existing.regulatoryRegime, REGULATORY_REGIME_LABELS),
                "Regime name": auditText(existing.regimeName),
                "Regulator's deadline": auditText(existing.regulatorDeadline),
                "Facts needed within": existing.factsNeededHours !== null ? `${existing.factsNeededHours} hours` : null,
                "Post-incident report due": existing.postIncidentReportDays !== null ? `${existing.postIncidentReportDays} days` : null,
              }
            : {}),
        }
      : {
          "Incident notification time": null,
          "Subprocessor change notice": null,
          "Audit right": null,
          "Availability SLA": null,
          "EU VoP status": null,
          "UK CoP status": null,
          "Agreement expiry date": null,
          "Contract PDF link": null,
          ...(isCustomerAgreement
            ? {
                "Regulatory regime": null,
                "Regime name": null,
                "Regulator's deadline": null,
                "Facts needed within": null,
                "Post-incident report due": null,
              }
            : {}),
        };

    // Regime None clears facts hours on save; the audit log keeps the old value (M26 AC4).
    const regulatoryRegime = isCustomerAgreement ? input.regulatoryRegime ?? null : null;
    const regimeName = isCustomerAgreement && regulatoryRegime === "OTHER" ? input.regimeName ?? null : null;
    const regulatorDeadline = isCustomerAgreement ? input.regulatorDeadline ?? null : null;
    const factsNeededHours = isCustomerAgreement && regulatoryRegime !== "NONE" ? input.factsNeededHours ?? null : null;
    const postIncidentReportDays = isCustomerAgreement && regulatoryRegime !== "NONE" ? input.postIncidentReportDays ?? null : null;

    const after = {
      "Incident notification time": input.incidentNoticeHours != null ? `${input.incidentNoticeHours} hours` : null,
      "Subprocessor change notice": input.subprocessorNoticeDays != null ? `${input.subprocessorNoticeDays} days` : null,
      "Audit right": auditBoolean(input.auditRight ?? null),
      "Availability SLA": input.availabilitySlaPct != null ? String(input.availabilitySlaPct) : null,
      "EU VoP status": input.euVopStatus ? SCHEME_ADHERENCE_LABELS[input.euVopStatus] : null,
      "UK CoP status": input.ukCopStatus ? SCHEME_ADHERENCE_LABELS[input.ukCopStatus] : null,
      "Agreement expiry date": auditDate(input.expiryDate ?? null),
      "Contract PDF link": auditText(input.contractUrl ?? null),
      ...(isCustomerAgreement
        ? {
            "Regulatory regime": auditEnum(regulatoryRegime, REGULATORY_REGIME_LABELS),
            "Regime name": auditText(regimeName),
            "Regulator's deadline": auditText(regulatorDeadline),
            "Facts needed within": factsNeededHours !== null ? `${factsNeededHours} hours` : null,
            "Post-incident report due": postIncidentReportDays !== null ? `${postIncidentReportDays} days` : null,
          }
        : {}),
    };

    const data = {
      incidentNoticeHours: input.incidentNoticeHours ?? null,
      subprocessorNoticeDays: input.subprocessorNoticeDays ?? null,
      auditRight: input.auditRight ?? null,
      availabilitySlaPct: input.availabilitySlaPct ?? null,
      euVopStatus: input.euVopStatus ?? null,
      ukCopStatus: input.ukCopStatus ?? null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      contractUrl: input.contractUrl ?? null,
      regulatoryRegime,
      regimeName,
      regulatorDeadline,
      factsNeededHours,
      postIncidentReportDays,
      updatedById: user.id,
    };

    const card = existing
      ? await tx.obligationCard.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.obligationCard.create({ data: { entityId, kind, ...data } });

    const kindLabel = OBLIGATION_CARD_KIND_LABELS[kind];
    await log.change({
      objectType: "OBLIGATIONS",
      objectId: card.id,
      objectLabel: `Obligations: ${kindLabel}`,
      fields: existing ? updateFields(before, after) : createFields(after),
    });
    await log.history({ category: "OTHER_FIELD_CHANGES", summary: `${kindLabel} obligations changed` });

    return card;
  });
}
