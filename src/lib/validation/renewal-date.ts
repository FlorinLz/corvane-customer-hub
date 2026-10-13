import { z } from "zod";

// Brief 3.4.2 "Customer role / Renewal date".
export const renewalDateSchema = z.object({
  renewalDate: z.string(),
  note: z.string().trim().max(1000).optional(),
  version: z.number().int(),
});

export type RenewalDateInput = z.infer<typeof renewalDateSchema>;
