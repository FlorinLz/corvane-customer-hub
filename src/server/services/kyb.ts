import { createFields, updateFields } from "@/server/audit/record";
import { auditDate } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { today } from "@/lib/dates";
import { approvedDocHosts, checkDocLink, docLinkError } from "@/lib/validation/url";
import type { VerifyLicenceInput } from "@/lib/validation/kyb";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

/** Brief 3.8.2 "Save KYB check", M12 AC2-AC10, AC13, AC14. Compliance. M5 R1 scope is the Licence check. */
export async function verifyLicence(user: SessionUser, entityId: string, input: VerifyLicenceInput) {
  assertCan(user, "compliance.kyb.edit");

  if (input.verifiedOn > today()) {
    throw new ValidationError({ verifiedOn: ["Verified on cannot be in the future"] });
  }
  if (!input.noExpiry && input.expiryDate && input.verifiedOn > input.expiryDate) {
    throw new ValidationError({ verifiedOn: ["Verified on cannot be after the expiry date"] });
  }
  const linkCheck = checkDocLink(input.evidenceUrl, approvedDocHosts());
  if (linkCheck !== "ok") {
    throw new ValidationError({ evidenceUrl: [docLinkError(linkCheck)!] });
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "compliance.kyb.edit", { entity: { deletedAt: entity.deletedAt } });

    const existing = await tx.kybCheck.findUnique({ where: { entityId_type: { entityId, type: "LICENCE" } } });
    if (existing && existing.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "KYB_CHECK", existing.id, "KYB check"));
    }

    const before = existing
      ? {
          "Licence number": existing.licenceNumber,
          "Issuing authority": existing.issuingAuthority,
          "Expiry date": existing.noExpiry ? "No expiry date" : auditDate(existing.expiryDate),
          "Verified on": auditDate(existing.verifiedOn),
          "Evidence link": existing.evidenceUrl,
        }
      : { "Licence number": null, "Issuing authority": null, "Expiry date": null, "Verified on": null, "Evidence link": null };

    const after = {
      "Licence number": input.licenceNumber,
      "Issuing authority": input.issuingAuthority,
      "Expiry date": input.noExpiry ? "No expiry date" : auditDate(input.expiryDate ?? null),
      "Verified on": auditDate(input.verifiedOn),
      "Evidence link": input.evidenceUrl,
    };

    const data = {
      licenceNumber: input.licenceNumber,
      issuingAuthority: input.issuingAuthority,
      expiryDate: input.noExpiry ? null : input.expiryDate ? new Date(input.expiryDate) : null,
      noExpiry: input.noExpiry,
      verifiedOn: new Date(input.verifiedOn),
      evidenceUrl: input.evidenceUrl,
      verifiedById: user.id,
    };

    const check = existing
      ? await tx.kybCheck.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.kybCheck.create({ data: { entityId, type: "LICENCE", ...data } });

    await log.change({
      objectType: "KYB_CHECK",
      objectId: check.id,
      objectLabel: "KYB: Licence",
      fields: existing ? updateFields(before, after) : createFields(after),
    });
    await log.history({ category: "OTHER_FIELD_CHANGES", summary: "Licence verification saved" });

    return check;
  });
}
