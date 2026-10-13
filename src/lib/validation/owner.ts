import { z } from "zod";

// Brief 3.4.2 "Owner", M9 AC5, AC6.
export const reassignOwnerSchema = z.object({
  newOwnerId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Reason is required (minimum 10 characters)")
    .max(500, "Reason is required (minimum 10 characters)"),
  expectedOwnerId: z.string().nullable(),
});

export type ReassignOwnerInput = z.infer<typeof reassignOwnerSchema>;
