import { z } from "zod";

// Brief 3.4.2 "KYB Licence", M12 AC2, AC6, AC7. M5 R1 scope is Licence
// verification only (Ownership/Sanctions and periodic review are R2).
export const verifyLicenceSchema = z
  .object({
    licenceNumber: z.string().trim().min(1, "Enter the licence number").max(50, "Enter the licence number"),
    issuingAuthority: z.string().trim().min(1, "Enter the issuing authority").max(120, "Enter the issuing authority"),
    expiryDate: z.string().nullable().optional(),
    noExpiry: z.boolean(),
    verifiedOn: z.string(),
    evidenceUrl: z.string().trim(),
    version: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (!data.noExpiry && !data.expiryDate) {
      ctx.addIssue({ code: "custom", path: ["expiryDate"], message: "Enter the expiry date, or tick \"No expiry date\"" });
    }
  });

export type VerifyLicenceInput = z.infer<typeof verifyLicenceSchema>;
