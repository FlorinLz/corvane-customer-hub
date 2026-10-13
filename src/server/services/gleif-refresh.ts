import { updateFields } from "@/server/audit/record";
import { auditDate, auditEnum } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { now } from "@/lib/dates";
import { LEI_STATUS_LABELS } from "@/lib/labels";
import { lookupLei } from "@/server/gleif/client";
import { mapGleifToEntityFields } from "@/server/gleif/map";
import { ConflictError, GleifUnavailableError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/**
 * Brief 3.8.2 "Retry or refresh GLEIF", M2 error state, M12 AC3, AC14.
 * Ops (header retry, only when NOT_VERIFIED) or Compliance (LEI card).
 * Unavailable: 503, nothing changes.
 */
export async function refreshGleif(user: SessionUser, entityId: string) {
  assertCan(user, "entity.gleifRefresh");

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "entity.gleifRefresh", { entity: { deletedAt: entity.deletedAt } });

    if (user.team === "OPS" && entity.leiStatus !== "NOT_VERIFIED") {
      throw new ConflictError("GLEIF refresh from the header is only available while the LEI is not verified.");
    }
    if (!entity.lei) {
      throw new ValidationError({ lei: ["This entity has no LEI to refresh"] });
    }

    const lookup = await lookupLei(entity.lei);
    if (lookup.kind === "unavailable") throw new GleifUnavailableError();

    const fields = mapGleifToEntityFields(lookup, now());

    await tx.entity.update({
      where: { id: entityId },
      data: {
        leiStatus: fields.leiStatus,
        gleifRawStatus: fields.gleifRawStatus,
        leiNextRenewalDate: fields.leiNextRenewalDate ? new Date(fields.leiNextRenewalDate) : null,
        gleifCheckedAt: fields.gleifCheckedAt,
        gleifSource: fields.gleifSource,
        gleifLegalName: fields.gleifLegalName,
        gleifCountry: fields.gleifCountry,
        gleifDirectParentLei: fields.gleifDirectParentLei,
        gleifDirectParentName: fields.gleifDirectParentName,
        gleifUltimateParentLei: fields.gleifUltimateParentLei,
        gleifUltimateParentName: fields.gleifUltimateParentName,
        gleifSuccessorLei: fields.gleifSuccessorLei,
      },
    });

    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: entityId,
      objectLabel: "LEI",
      fields: updateFields(
        { "LEI status": auditEnum(entity.leiStatus, LEI_STATUS_LABELS), "Next renewal date": auditDate(entity.leiNextRenewalDate) },
        { "LEI status": auditEnum(fields.leiStatus, LEI_STATUS_LABELS), "Next renewal date": auditDate(fields.leiNextRenewalDate) },
      ),
      source: "SYSTEM_GLEIF",
    });
    await log.history({ category: "OTHER_FIELD_CHANGES", summary: "GLEIF data refreshed" });

    return { leiStatus: fields.leiStatus, gleifCheckedAt: fields.gleifCheckedAt };
  });
}
