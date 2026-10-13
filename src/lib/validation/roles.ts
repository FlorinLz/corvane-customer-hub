import { z } from "zod";

// Brief 3.8.2 "Set roles". M5 R1 scope is "add only" (M4 AC7 part): the
// service rejects an attempt to turn an active role off, since removal
// (M4 AC8, with its needsConfirmation counts flow) is R2.
export const setRolesSchema = z.object({
  customer: z.boolean(),
  partner: z.boolean(),
  version: z.number().int(),
});

export type SetRolesInput = z.infer<typeof setRolesSchema>;
