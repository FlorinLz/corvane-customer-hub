import type { Prisma } from "@prisma/client";
import { createFields } from "@/server/audit/record";
import { mutate } from "@/server/audit/mutate";
import { versionConflictMessage } from "@/server/audit/conflict";
import { now } from "@/lib/dates";
import { effectiveTimeZone, formatInZone } from "@/lib/time-zones";
import { COMMUNICATION_CHANNEL_LABELS, COMMUNICATION_TYPE_LABELS, issueDisplayId } from "@/lib/labels";
import type { RecordCommunicationInput, CloseIssueInput } from "@/lib/validation/issues";
import { assertIsCommunicator, requireIssueEntity } from "@/server/issues/roles";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { closeWhenAllStepsDone } from "@/server/issues/close-when-done";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import type { SessionUser } from "@/server/permissions/can";

// Brief M22 AC6, AC7, AC11, AC12. Split from issue.ts: these two actions
// are gated on the effective *communicator*, not the owner, and follow
// a different identity check (assertIsCommunicator vs. assertIsOwner).

function resolvePersonName(contactName: string | undefined, freeText: string | undefined): string {
  return contactName ?? freeText ?? "—";
}

/** Brief M22 AC6, AC7, edge case 3. First notification sets `notifiedAt` once (M19 AC5). */
export async function recordCommunication(user: SessionUser, issueId: string, input: RecordCommunicationInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.communicator");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    await assertIsCommunicator(tx, { ...issue, entityId: issue.entityId }, user);

    const occurredAt = new Date(input.occurredAt);
    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    if (occurredAt > now()) {
      throw new ValidationError({ occurredAt: ["The time can't be in the future"] });
    }
    if (occurredAt < issue.awareAt) {
      throw new ValidationError({ occurredAt: [`The time can't be before Corvane aware at (${formatInZone(issue.awareAt, zone)})`] });
    }

    let contact: { fullName: string } | null = null;
    if (input.contactId) {
      contact = await tx.contact.findUnique({ where: { id: input.contactId }, select: { fullName: true } });
      if (!contact) throw new ValidationError({ contactId: ["Select who you notified"] });
    }
    const personName = resolvePersonName(contact?.fullName, input.personName);

    const created = await tx.issueCommunication.create({
      data: {
        issueId: issue.id,
        type: input.type,
        occurredAt,
        channel: input.channel,
        contactId: input.contactId ?? null,
        personName,
        message: input.message,
        recordedById: user.id,
        recordedByName: user.name,
        createdAt: now(),
      },
    });

    if (input.type === "FIRST_NOTIFICATION" && !issue.notifiedAt) {
      await tx.issue.update({ where: { id: issue.id }, data: { notifiedAt: occurredAt, version: { increment: 1 } } });
    } else {
      await tx.issue.update({ where: { id: issue.id }, data: { version: { increment: 1 } } });
    }
    const notifiedNow = input.type === "FIRST_NOTIFICATION" && !issue.notifiedAt;

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: createFields({
        Type: COMMUNICATION_TYPE_LABELS[input.type],
        Time: formatInZone(occurredAt, zone),
        Channel: COMMUNICATION_CHANNEL_LABELS[input.channel],
        Person: personName,
        Message: input.message,
      }),
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)}: ${COMMUNICATION_TYPE_LABELS[input.type]} to ${personName} by ${COMMUNICATION_CHANNEL_LABELS[input.channel]}, recorded by ${user.name}`,
    });
    // A notification recorded after the resolution can be the last step.
    if (notifiedNow) await closeWhenAllStepsDone(tx, log, issue.id, user.id, now());

    return created;
  });
}

/**
 * Brief M22 AC11, AC12. Communicator only, status Resolved. Records the confirmation of the resolution with the customer (the partner, on a
 * partner issue). The issue closes only when every step is done: with the root cause report (or the Compliance assessment) still open it stays
 * Resolved, and the last of those steps closes it.
 */
export async function closeIssue(user: SessionUser, issueId: string, input: CloseIssueInput) {
  const { entityId } = await requireIssueEntity(issueId, user, "issue.communicator");
  await ensureSystemWrites(issueId);

  return mutate(user, { entityId }, async (tx, log) => {
    const issue = await tx.issue.findUnique({ where: { id: issueId } });
    if (!issue) throw new NotFoundError();
    if (issue.version !== input.version) {
      throw new ConflictError(await versionConflictMessage(tx, "ISSUE", issue.id, "issue"));
    }
    // Permission before business rule (4.9.12: a non-communicator gets 403 regardless of status).
    await assertIsCommunicator(tx, { ...issue, entityId: issue.entityId }, user);
    if (issue.status !== "RESOLVED") {
      throw new ValidationError({ status: ["This issue isn't Resolved yet"] });
    }
    if (await tx.issueCommunication.findFirst({ where: { issueId: issue.id, type: "CLOSURE_CONFIRMED" }, select: { id: true } })) {
      throw new ValidationError({ status: ["The resolution is already confirmed"] });
    }

    const occurredAt = new Date(input.occurredAt);
    const requester = await tx.user.findUnique({ where: { id: user.id }, select: { timeZone: true, team: true } });
    const zone = requester ? effectiveTimeZone(requester) : "Europe/Bucharest";
    if (occurredAt > now()) {
      throw new ValidationError({ occurredAt: ["The time can't be in the future"] });
    }
    // The form takes minutes: "now" read to the minute, right after a resolution within that same minute, is not "before" it.
    if (issue.resolvedAt && occurredAt < new Date(Math.floor(issue.resolvedAt.getTime() / 60_000) * 60_000)) {
      throw new ValidationError({ occurredAt: [`The time can't be before Resolved at (${formatInZone(issue.resolvedAt, zone)})`] });
    }

    let contact: { fullName: string } | null = null;
    if (input.personContactId) {
      contact = await tx.contact.findUnique({ where: { id: input.personContactId }, select: { fullName: true } });
      if (!contact) throw new ValidationError({ personContactId: ["Select who confirmed the resolution"] });
    }
    const personName = resolvePersonName(contact?.fullName, input.personName);
    const confirmedBy = `${personName} (${COMMUNICATION_CHANNEL_LABELS[input.channel]})`;

    const t = now();
    await tx.issueCommunication.create({
      data: {
        issueId: issue.id,
        type: "CLOSURE_CONFIRMED",
        occurredAt,
        channel: input.channel,
        contactId: input.personContactId ?? null,
        personName,
        message: input.note?.trim() ? input.note.trim() : `Resolution confirmed by ${confirmedBy}`,
        recordedById: user.id,
        recordedByName: user.name,
        createdAt: t,
      },
    });

    const who = (await isPartnerIssueRow(tx, issue.id)) ? "partner" : "customer";
    const updated = await tx.issue.update({ where: { id: issue.id }, data: { version: { increment: 1 } } });

    await log.change({
      objectType: "ISSUE",
      objectId: issue.id,
      objectLabel: `Issue: ${issueDisplayId(issue.number)}`,
      fields: [{ field: `Resolution confirmed with the ${who}`, oldValue: null, newValue: confirmedBy }],
    });
    await log.history({
      category: "INCIDENT",
      issueId: issue.id,
      summary: `${issueDisplayId(issue.number)} resolution confirmed with the ${who} by ${user.name}: ${confirmedBy}`,
    });
    return (await closeWhenAllStepsDone(tx, log, issue.id, user.id, t)) ?? updated;
  });
}

/** A partner issue: its communicator rule is "issue owner, partner" (the confirmation is with the partner, not a customer). */
async function isPartnerIssueRow(tx: Prisma.TransactionClient, issueId: string): Promise<boolean> {
  const row = await tx.issue.findUnique({ where: { id: issueId }, select: { communicatorRule: true } });
  return row?.communicatorRule === "ISSUE_OWNER_PARTNER";
}
