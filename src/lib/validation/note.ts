import { z } from "zod";
import { NoteType } from "@prisma/client";

// Brief 3.4.2 "Note", M10 AC2, AC3.
export const noteParticipantSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("USER"), userId: z.string().min(1) }),
  z.object({ kind: z.literal("CONTACT"), contactId: z.string().min(1) }),
  z.object({ kind: z.literal("FREE_TEXT"), name: z.string().trim().min(1).max(120) }),
]);

export const actionItemSchema = z.object({
  description: z.string().trim().min(1, "Complete or remove this action item").max(300, "Complete or remove this action item"),
  ownerId: z.string().min(1, "Complete or remove this action item"),
  dueDate: z.string().min(1, "Complete or remove this action item"),
});

export const addNoteSchema = z.object({
  type: z.enum(NoteType),
  interactionDate: z.string(),
  participants: z.array(noteParticipantSchema).max(10),
  summary: z.string().trim().min(20, "Summary must be 20 to 5,000 characters").max(5000, "Summary must be 20 to 5,000 characters"),
  actionItems: z.array(actionItemSchema).max(20),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type NoteParticipantInput = z.infer<typeof noteParticipantSchema>;
