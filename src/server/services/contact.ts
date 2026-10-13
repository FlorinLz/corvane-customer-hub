import { createFields, updateFields } from "@/server/audit/record";
import { auditArray, auditDate, auditEnum, auditText } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { today } from "@/lib/dates";
import { CONTACT_ROLE_LABELS } from "@/lib/labels";
import { normalisePhone } from "@/lib/validation/phone";
import type { AddContactInput, EditContactInput, VerifyContactInput } from "@/lib/validation/contact";
import { contactDataArea, contactOwnerTeams } from "@/server/derived/contact-ownership";
import { ConflictError, NotFoundError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { db } from "@/server/db";

function availabilityFields(input: { availability?: AddContactInput["availability"] }) {
  const a = input.availability;
  if (!a) return { available24x7: false, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
  if (a.available24x7) return { available24x7: true, availabilityDays: [], availabilityStart: null, availabilityEnd: null };
  return { available24x7: false, availabilityDays: a.days, availabilityStart: a.start, availabilityEnd: a.end };
}

function availabilityAuditValue(input: { availability?: AddContactInput["availability"] }): string | null {
  const a = input.availability;
  if (!a) return null;
  if (a.available24x7) return "24/7";
  return `${auditArray(a.days.map(String))} ${a.start}-${a.end}`;
}

/** Brief 3.8.2 "Add contact", M7 AC1-AC4, AC12, AC14, AC15. Owner team of (context, role). */
export async function addContact(user: SessionUser, entityId: string, input: AddContactInput) {
  const area = contactDataArea(input.context, input.role);
  assertCan(user, "contact.add", { area });

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "contact.add", { entity: { deletedAt: entity.deletedAt }, area });

    const email = input.email.trim().toLowerCase();
    const existingDuplicate = await tx.contact.findFirst({
      where: { entityId, context: input.context, role: input.role, email, status: "ACTIVE" },
    });
    if (existingDuplicate && !input.confirmDuplicate) {
      throw new ConflictError(`${existingDuplicate.fullName} is already an active ${CONTACT_ROLE_LABELS[input.role]} contact`, true);
    }

    const phone = input.phone?.trim() ? normalisePhone(input.phone.trim()) : null;
    const ownerTeams = contactOwnerTeams(input.context, input.role);

    if (input.isPrimary && input.role === "INCIDENT") {
      await tx.contact.updateMany({
        where: { entityId, context: input.context, role: "INCIDENT", isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await tx.contact.create({
      data: {
        entityId,
        context: input.context,
        role: input.role,
        ownerTeams,
        fullName: input.fullName.trim(),
        email,
        phone,
        timeZone: input.timeZone?.trim() || null,
        jobTitle: input.jobTitle?.trim() || null,
        isPrimary: Boolean(input.isPrimary) && input.role === "INCIDENT",
        lastVerifiedAt: new Date(today()),
        lastVerifiedById: user.id,
        ...availabilityFields(input),
      },
    });

    await log.change({
      objectType: "CONTACT",
      objectId: contact.id,
      objectLabel: `Contact: ${contact.fullName} (${CONTACT_ROLE_LABELS[contact.role]})`,
      fields: createFields({
        "Full name": contact.fullName,
        Email: contact.email,
        Phone: contact.phone,
        "Time zone": contact.timeZone,
        Availability: availabilityAuditValue(input),
        "Job title": contact.jobTitle,
        Role: CONTACT_ROLE_LABELS[contact.role],
      }),
    });
    await log.history({ category: "CONTACT_CHANGE", summary: `Contact added: ${contact.fullName} (${CONTACT_ROLE_LABELS[contact.role]})` });

    return contact;
  });
}

/** Brief 3.8.2 "Edit contact", M7 AC3, AC14, AC15, edge case 6. Owner teams. */
export async function editContact(user: SessionUser, contactId: string, input: EditContactInput) {
  const existing = await db.contact.findUnique({ where: { id: contactId } });
  if (!existing) throw new NotFoundError();
  const currentArea = contactDataArea(existing.context, existing.role);
  assertCan(user, "contact.edit", { area: currentArea });

  return mutate(user, { entityId: existing.entityId }, async (tx, log) => {
    const contact = await tx.contact.findUnique({ where: { id: contactId }, include: { entity: { select: { deletedAt: true } } } });
    if (!contact) throw new NotFoundError();
    assertCan(user, "contact.edit", { entity: { deletedAt: contact.entity.deletedAt }, area: currentArea });
    if (contact.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CONTACT", contactId, "contact"));
    }

    const email = input.email.trim().toLowerCase();
    const phone = input.phone?.trim() ? normalisePhone(input.phone.trim()) : null;
    const newOwnerTeams = contactOwnerTeams(input.context, input.role);

    const before = {
      Role: CONTACT_ROLE_LABELS[contact.role],
      Email: contact.email,
      Phone: contact.phone,
      "Time zone": contact.timeZone,
      Availability: contact.available24x7
        ? "24/7"
        : contact.availabilityStart
          ? `${auditArray(contact.availabilityDays.map(String))} ${contact.availabilityStart}-${contact.availabilityEnd}`
          : null,
      Status: auditEnum(contact.status, { ACTIVE: "Active", LEFT: "Left" }),
    };
    const after = {
      Role: CONTACT_ROLE_LABELS[input.role],
      Email: email,
      Phone: phone,
      "Time zone": auditText(input.timeZone ?? null),
      Availability: availabilityAuditValue(input),
      Status: "Active",
    };

    await tx.contact.update({
      where: { id: contactId },
      data: {
        context: input.context,
        role: input.role,
        ownerTeams: newOwnerTeams,
        fullName: input.fullName.trim(),
        email,
        phone,
        jobTitle: input.jobTitle?.trim() || null,
        status: input.status ?? contact.status,
        leftOn: input.status === "ACTIVE" ? null : contact.leftOn,
        leftNote: input.status === "ACTIVE" ? null : contact.leftNote,
        version: { increment: 1 },
        ...availabilityFields(input),
      },
    });

    await log.change({
      objectType: "CONTACT",
      objectId: contactId,
      objectLabel: `Contact: ${contact.fullName} (${CONTACT_ROLE_LABELS[contact.role]})`,
      fields: updateFields(before, after),
    });
    await log.history({ category: "CONTACT_CHANGE", summary: `Contact updated: ${input.fullName.trim()}` });

    return { id: contactId };
  });
}

/** Brief 3.8.2 "Mark as verified", M7 AC5, AC15. Owner teams. Audit only — no History event. */
export async function verifyContact(user: SessionUser, contactId: string, input: VerifyContactInput) {
  const existing = await db.contact.findUnique({ where: { id: contactId } });
  if (!existing) throw new NotFoundError();
  const area = contactDataArea(existing.context, existing.role);
  assertCan(user, "contact.verify", { area });

  return mutate(user, { entityId: existing.entityId }, async (tx, log) => {
    const contact = await tx.contact.findUnique({ where: { id: contactId }, include: { entity: { select: { deletedAt: true } } } });
    if (!contact) throw new NotFoundError();
    assertCan(user, "contact.verify", { entity: { deletedAt: contact.entity.deletedAt }, area });
    if (contact.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "CONTACT", contactId, "contact"));
    }

    const verifiedAt = new Date(today());
    await tx.contact.update({
      where: { id: contactId },
      data: { lastVerifiedAt: verifiedAt, lastVerifiedById: user.id, version: { increment: 1 } },
    });

    await log.change({
      objectType: "CONTACT",
      objectId: contactId,
      objectLabel: `Contact: ${contact.fullName} (${CONTACT_ROLE_LABELS[contact.role]})`,
      fields: updateFields({ "Last verified": auditDate(contact.lastVerifiedAt) }, { "Last verified": auditDate(today()) }),
    });

    return { id: contactId };
  });
}
