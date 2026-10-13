import { z } from "zod";

// Brief 3.4.x, M8 AC3-AC9. Ops -> CS handoff send form.

export const sendOpsToCsSchema = z
  .object({
    blockNotes: z.record(z.string(), z.string().trim().max(300, "Note must be 300 characters or fewer")),
    commitments: z
      .array(
        z.object({
          description: z.string().trim().min(5, "Description must be 5 to 300 characters").max(300, "Description must be 5 to 300 characters"),
          dueDate: z.string().nullable(),
        }),
      )
      .max(50),
    noOpenCommitments: z.boolean(),
    confirmedContactIds: z.array(z.string()),
    onboardingManagerId: z.string().min(1, "Choose the receiving CSM"),
    noteForCsm: z.string().trim().max(1000, "Note must be 1,000 characters or fewer").nullable().optional(),
  })
  // M8 AC5: "If there are none, Ops must tick 'No open commitments'. The section cannot be left empty."
  .refine((v) => v.commitments.length > 0 || v.noOpenCommitments, {
    message: "Add a commitment, or tick 'No open commitments'",
    path: ["commitments"],
  });

export type SendOpsToCsInput = z.infer<typeof sendOpsToCsSchema>;
