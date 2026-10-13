import { z } from "zod";

// Brief 3.4.2 "Contract". M5 R1 scope is a new entity contract only
// (scope literal ENTITY_CONTRACT); group master agreements are R2 (M4 AC10).
export const attachContractSchema = z.object({
  contractId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9\-/_]{3,50}$/, "Contract ID must be 3 to 50 letters, digits, -, / or _"),
  title: z.string().trim().min(1, "Enter the contract title").max(200, "Enter the contract title"),
  signingDate: z.string(), // LocalDate; "not after today" is checked against the clock in the service
  scope: z.literal("ENTITY_CONTRACT"),
  invoicedEntityId: z.string().min(1),
  documentUrl: z.string().trim(),
});

export type AttachContractInput = z.infer<typeof attachContractSchema>;
