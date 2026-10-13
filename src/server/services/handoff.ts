import { updateFields, createFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { now, today } from "@/lib/dates";
import { onCustomerOwnerChanged } from "@/server/issues/communicator-sync";
import { contactOwnerTeams } from "@/server/derived/contact-ownership";
import type { SendOpsToCsInput } from "@/lib/validation/handoff";
import type { OpsToCsSnapshot } from "@/server/services/handoff.types";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";
import { db } from "@/server/db";

const DELETED_MESSAGE = "This record was deleted. Contact the admin to reactivate it.";

/** Brief 3.8.2 "Confirm pickup", M3 AC12, edge case 7. Only the named Onboarding Manager. */
export async function confirmPickup(user: SessionUser, handoffId: string) {
  assertCan(user, "handoff.salesOps");

  const handoff = await db.handoff.findUnique({ where: { id: handoffId }, include: { entity: { select: { deletedAt: true } }, fromUser: { select: { name: true } } } });
  if (!handoff || handoff.type !== "SALES_TO_OPS") throw new NotFoundError();
  if (handoff.entity.deletedAt) throw new ConflictError(DELETED_MESSAGE);
  if (handoff.toUserId !== user.id) throw new ForbiddenError("Ops");
  if (handoff.status !== "SENT") throw new ConflictError("This handoff was already actioned. Reload to see its current state.");

  return mutate(user, { entityId: handoff.entityId }, async (tx, log) => {
    const entity = await tx.entity.findUniqueOrThrow({ where: { id: handoff.entityId }, select: { ownerId: true } });
    const t = now();
    const updated = await tx.handoff.update({ where: { id: handoffId }, data: { status: "CONFIRMED", confirmedAt: t } });
    await tx.entity.update({ where: { id: handoff.entityId }, data: { ownerId: user.id, ownerSince: t } });
    await onCustomerOwnerChanged(tx, handoff.entityId, entity.ownerId, user.id, user);

    await log.change({
      objectType: "HANDOFF",
      objectId: handoffId,
      objectLabel: "Handoff",
      fields: updateFields({ Status: "Sent" }, { Status: "Confirmed" }),
    });
    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: handoff.entityId,
      objectLabel: "Owner",
      fields: updateFields({ Owner: handoff.fromUser.name }, { Owner: user.name }),
    });
    await log.history({ category: "HANDOFF", summary: `Handoff confirmed by ${user.name}`, handoffId });
    await log.history({ category: "OWNER_REASSIGNED", summary: `Owner changed from ${handoff.fromUser.name} to ${user.name}` });

    return updated;
  });
}

/** Brief 3.8.2 "Hand over to Customer Success", M8 AC1-AC9. Any active Ops user. */
export async function sendOpsToCs(user: SessionUser, entityId: string, input: SendOpsToCsInput) {
  assertCan(user, "handoff.opsCs");

  const entity = await db.entity.findUnique({
    where: { id: entityId },
    include: {
      customerRole: { select: { active: true } },
      products: { where: { cancelledAt: null }, select: { id: true, product: true, country: true, stage: true, stageEnteredAt: true, billableFrom: true, blockedBy: true, blockedReason: true, blockedSince: true } },
      contacts: { where: { context: "CUSTOMER", status: "ACTIVE" }, select: { id: true, role: true, fullName: true, email: true, phone: true, lastVerifiedAt: true, ownerTeams: true } },
    },
  });
  if (!entity) throw new NotFoundError();
  if (entity.deletedAt) throw new ConflictError(DELETED_MESSAGE);

  const hasEligibleProduct = entity.products.some((p) => p.stage === "RAMP_UP" || p.stage === "BAU");
  if (!hasEligibleProduct) {
    throw new ValidationError({ entity: ["Available when at least one product has completed hypercare"] });
  }
  const openExisting = await db.handoff.findFirst({ where: { entityId, type: "OPS_TO_CS", status: "SENT" } });
  if (openExisting) throw new ConflictError("A handoff to Customer Success is already pending for this entity.");

  const activeIncidentContact = entity.contacts.some((c) => c.role === "INCIDENT");
  if (!activeIncidentContact) {
    throw new ValidationError({ contacts: ["Add an active incident contact before handing over"] });
  }

  const csm = await db.user.findUnique({ where: { id: input.onboardingManagerId } });
  if (!csm || !csm.active || csm.team !== "CS") {
    throw new ValidationError({ onboardingManagerId: ["Choose the receiving CSM"] });
  }

  const openBlocks = entity.products.filter((p) => p.blockedBy !== null);
  for (const b of openBlocks) {
    if (!(b.id in input.blockNotes) || input.blockNotes[b.id].trim().length === 0) {
      throw new ValidationError({ blockNotes: ["Add a handoff note for every open block"] });
    }
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const confirmedIds = new Set(input.confirmedContactIds);
    const t = today();
    const confirmedContacts: OpsToCsSnapshot["confirmedContacts"] = [];
    const confirmedNowIds: string[] = [];
    for (const c of entity.contacts) {
      const ownsIt = contactOwnerTeams("CUSTOMER", c.role).includes("OPS");
      const confirmNow = ownsIt && confirmedIds.has(c.id);
      if (confirmNow) confirmedNowIds.push(c.id);
      confirmedContacts.push({
        role: c.role,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        lastVerifiedAt: confirmNow ? t : c.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
        confirmedNow: confirmNow,
      });
    }
    // One update for every contact confirmed now, not one per contact (this transaction is clocked from its start).
    if (confirmedNowIds.length > 0) await tx.contact.updateMany({ where: { id: { in: confirmedNowIds } }, data: { lastVerifiedAt: new Date(t), lastVerifiedById: user.id } });

    const snapshot: OpsToCsSnapshot = {
      v: 1,
      type: "OPS_TO_CS",
      productStages: entity.products.map((p) => ({
        product: p.product,
        country: p.country,
        stage: p.stage,
        stageEnteredAt: p.stageEnteredAt.toISOString().slice(0, 10),
        billableFrom: p.billableFrom?.toISOString().slice(0, 10) ?? null,
      })),
      openBlocks: openBlocks.map((b) => ({
        product: b.product,
        country: b.country,
        blockedBy: b.blockedBy!,
        reason: b.blockedReason ?? "",
        blockedSince: b.blockedSince?.toISOString().slice(0, 10) ?? "",
        note: input.blockNotes[b.id]?.trim() ?? "",
      })),
      commitments: input.noOpenCommitments ? "NONE" : input.commitments.map((c) => ({ description: c.description, dueDate: c.dueDate })),
      confirmedContacts,
      noteForCsm: input.noteForCsm?.trim() || null,
    };

    const handoffSentAt = now();
    const handoff = await tx.handoff.create({
      data: { entityId, type: "OPS_TO_CS", status: "SENT", fromUserId: user.id, toUserId: csm.id, sentAt: handoffSentAt, snapshot, createdAt: handoffSentAt },
    });

    await log.change({
      objectType: "HANDOFF",
      objectId: handoff.id,
      objectLabel: "Handoff",
      fields: createFields({ "Sent to": csm.name, Type: "Ops to Customer Success" }),
    });
    await log.history({ category: "HANDOFF", summary: `Handoff to Customer Success sent to ${csm.name} by ${user.name}`, handoffId: handoff.id });

    return { id: handoff.id };
  });
}

/** Brief 3.8.2 "Accept", M8 AC11, edge case 2. Only the named CSM, while still in Customer Success. */
export async function acceptOpsToCs(user: SessionUser, handoffId: string) {
  assertCan(user, "handoff.opsCs");

  const handoff = await db.handoff.findUnique({ where: { id: handoffId }, include: { entity: { select: { deletedAt: true } }, fromUser: { select: { name: true } } } });
  if (!handoff || handoff.type !== "OPS_TO_CS") throw new NotFoundError();
  if (handoff.entity.deletedAt) throw new ConflictError(DELETED_MESSAGE);
  if (handoff.toUserId !== user.id) throw new ForbiddenError("Customer Success");
  if (handoff.status !== "SENT") throw new ConflictError("This handoff was already actioned. Reload to see its current state.");
  if (user.team !== "CS") throw new ConflictError("Recipient no longer in Customer Success");

  return mutate(user, { entityId: handoff.entityId }, async (tx, log) => {
    const entity = await tx.entity.findUniqueOrThrow({ where: { id: handoff.entityId }, select: { ownerId: true } });
    const t = now();
    const updated = await tx.handoff.update({ where: { id: handoffId }, data: { status: "ACCEPTED", acceptedAt: t } });
    await tx.entity.update({ where: { id: handoff.entityId }, data: { ownerId: user.id, ownerSince: t } });
    await onCustomerOwnerChanged(tx, handoff.entityId, entity.ownerId, user.id, user);

    await log.change({
      objectType: "HANDOFF",
      objectId: handoffId,
      objectLabel: "Handoff",
      fields: updateFields({ Status: "Sent" }, { Status: "Accepted" }),
    });
    await log.change({
      objectType: "LEGAL_ENTITY",
      objectId: handoff.entityId,
      objectLabel: "Owner",
      fields: updateFields({ Owner: handoff.fromUser.name }, { Owner: user.name }),
    });
    await log.history({ category: "HANDOFF", summary: `Handoff accepted by ${user.name}. Owner: ${handoff.fromUser.name} → ${user.name}`, handoffId });

    return updated;
  });
}
