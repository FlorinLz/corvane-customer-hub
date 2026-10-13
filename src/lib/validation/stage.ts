import { z } from "zod";
import { Stage } from "@prisma/client";

// Brief 3.8.2 "Change stage", M6 AC4-AC6, AC9, AC11, AC12. M5 R1 is
// forward N+1 only; skip and back are M6's R2 scope (guard 3, 7.6.9).
export const changeStageSchema = z.object({
  toStage: z.enum(Stage),
  entryDate: z.string(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().optional(),
  resolveBlock: z.boolean().optional(),
  version: z.number().int(),
});

export type ChangeStageInput = z.infer<typeof changeStageSchema>;
