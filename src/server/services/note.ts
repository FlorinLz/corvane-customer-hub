import type { Prisma } from "@prisma/client";

import { createFields } from "@/server/audit/record";
import { auditDate } from "@/server/audit/format";
import { mutate } from "@/server/audit/mutate";
import { now, today } from "@/lib/dates";
import { NOTE_TYPE_LABELS } from "@/lib/labels";
import { isDueDateValidAtCreation } from "@/lib/rules/notes";
import type { AddNoteInput, NoteParticipantInput } from "@/lib/validation/note";
import { NotFoundError, ValidationError } from "@/server/errors";
import { assertCan } from "@/server/permissions/guard";
import type { SessionUser } from "@/server/permissions/can";

async function resolveParticipant(tx: Prisma.TransactionClient, p: NoteParticipantInput) {
  if (p.kind === "USER") {
    const user = await tx.user.findUnique({ where: { id: p.userId } });
    if (!user) throw new ValidationError({ participants: ["Select an active user"] });
    return { kind: "USER" as const, userId: user.id, contactId: null, nameSnapshot: user.name };
  }
  if (p.kind === "CONTACT") {
    const contact = await tx.contact.findUnique({ where: { id: p.contactId } });
    if (!contact) throw new ValidationError({ participants: ["Select a contact of this entity"] });
    return { kind: "CONTACT" as const, userId: null, contactId: contact.id, nameSnapshot: contact.fullName };
  }
  return { kind: "FREE_TEXT" as const, userId: null, contactId: null, nameSnapshot: p.name };
}

/** Brief 3.8.2 "Add note", M10 AC1-AC4, M16 AC1. All teams — notes are their own timeline rows, not a History event. */
export async function addNote(user: SessionUser, entityId: string, input: AddNoteInput) {
  assertCan(user, "history.note.add");

  if (input.interactionDate > today()) {
    throw new ValidationError({ interactionDate: ["Interaction date cannot be in the future"] });
  }
  for (const item of input.actionItems) {
    if (!isDueDateValidAtCreation(item.dueDate, today())) {
      throw new ValidationError({ actionItems: ["Complete or remove this action item"] });
    }
  }

  return mutate(user, { entityId }, async (tx, log) => {
    const entity = await tx.entity.findUnique({ where: { id: entityId } });
    if (!entity) throw new NotFoundError();
    assertCan(user, "history.note.add", { entity: { deletedAt: entity.deletedAt } });

    const participants = await Promise.all(input.participants.map((p) => resolveParticipant(tx, p)));
    const ownerIds = [...new Set(input.actionItems.map((item) => item.ownerId))];
    if (ownerIds.length > 0 && (await tx.user.count({ where: { id: { in: ownerIds } } })) !== ownerIds.length) {
      throw new ValidationError({ actionItems: ["Select an active owner for every action item"] });
    }

    const note = await tx.note.create({
      data: {
        entityId,
        type: input.type,
        interactionDate: new Date(input.interactionDate),
        summary: input.summary,
        authorId: user.id,
        authorTeam: user.team,
        createdAt: now(),
        participants: { create: participants },
        actionItems: {
          create: input.actionItems.map((item, i) => ({
            position: i,
            description: item.description,
            ownerId: item.ownerId,
            dueDate: new Date(item.dueDate),
            status: "OPEN",
          })),
        },
      },
      include: { actionItems: true },
    });

    await log.change({
      objectType: "NOTE",
      objectId: note.id,
      objectLabel: `Note: ${NOTE_TYPE_LABELS[note.type]}`,
      fields: createFields({
        Type: NOTE_TYPE_LABELS[note.type],
        "Interaction date": auditDate(input.interactionDate),
        Summary: note.summary,
      }),
    });
    await log.changes(
      note.actionItems.map((item) => ({
        objectType: "ACTION_ITEM" as const,
        objectId: item.id,
        objectLabel: `Action item: ${item.description}`,
        fields: createFields({ Description: item.description, "Due date": auditDate(input.actionItems[item.position].dueDate) }),
      })),
    );

    return note;
  });
}
