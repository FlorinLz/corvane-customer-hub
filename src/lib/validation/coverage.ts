import { z } from "zod";
import { CoverageStatus } from "@prisma/client";

// Brief 3.4.2 "Coverage", M5 AC7-AC9, AC17. M5 R1: effective date must not
// be in the future (Scheduled status is R2, guard 4, 7.6.9).
export const changeCoverageStatusSchema = z.object({
  status: z.enum(CoverageStatus),
  effectiveDate: z.string(),
  reason: z.string().trim().min(5, "Reason is required (5 to 500 characters)").max(500, "Reason is required (5 to 500 characters)"),
  version: z.number().int(),
});

export type ChangeCoverageStatusInput = z.infer<typeof changeCoverageStatusSchema>;
