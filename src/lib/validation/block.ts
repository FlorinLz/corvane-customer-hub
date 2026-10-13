import { z } from "zod";
import { BlockedBy } from "@prisma/client";

// Brief 3.4.2 "Block", M6 AC7, AC8.
export const setBlockSchema = z.object({
  blockedBy: z.enum(BlockedBy),
  reason: z.string().trim().min(5, "Reason is required (5 to 500 characters)").max(500, "Reason is required (5 to 500 characters)"),
  version: z.number().int(),
});

export const resolveBlockSchema = z.object({
  note: z.string().trim().max(500).optional(),
  version: z.number().int(),
});

export type SetBlockInput = z.infer<typeof setBlockSchema>;
export type ResolveBlockInput = z.infer<typeof resolveBlockSchema>;
