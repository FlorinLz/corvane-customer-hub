import { z } from "zod";
import { RegulatoryRegime, SchemeAdherence } from "@prisma/client";

// Brief 3.4.2 "Obligations", M13 AC2-AC4. The Regulatory block (3.4.3,
// M26 AC2) is Customer-agreement-card only; the service enforces that,
// not this shape, since the same schema also validates Partner cards.
export const obligationsSchema = z
  .object({
    incidentNoticeHours: z.number().nullable().optional(),
    subprocessorNoticeDays: z.number().nullable().optional(),
    auditRight: z.boolean().nullable().optional(),
    availabilitySlaPct: z.number().nullable().optional(),
    euVopStatus: z.enum(SchemeAdherence).nullable().optional(),
    ukCopStatus: z.enum(SchemeAdherence).nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    contractUrl: z.string().trim().nullable().optional(),
    regulatoryRegime: z.enum(RegulatoryRegime).nullable().optional(),
    regimeName: z.string().trim().nullable().optional(),
    regulatorDeadline: z.string().trim().max(300).nullable().optional(),
    factsNeededHours: z.number().nullable().optional(),
    postIncidentReportDays: z.number().nullable().optional(),
    version: z.number().int(),
  })
  .superRefine((data, ctx) => {
    const hours = data.incidentNoticeHours;
    if (hours != null && (!Number.isInteger(hours) || hours < 1 || hours > 720)) {
      ctx.addIssue({ code: "custom", path: ["incidentNoticeHours"], message: "Enter a whole number of hours between 1 and 720" });
    }
    const days = data.subprocessorNoticeDays;
    if (days != null && (!Number.isInteger(days) || days < 0 || days > 365)) {
      ctx.addIssue({ code: "custom", path: ["subprocessorNoticeDays"], message: "Enter a whole number of days between 0 and 365" });
    }
    const sla = data.availabilitySlaPct;
    if (sla != null && (sla < 90 || sla > 100 || Math.round(sla * 100) !== sla * 100)) {
      ctx.addIssue({ code: "custom", path: ["availabilitySlaPct"], message: "Enter a percentage between 90.00 and 100.00" });
    }

    // Regulatory block (M26 AC2, AC4).
    if (data.regulatoryRegime === "OTHER") {
      const name = data.regimeName?.trim() ?? "";
      if (name.length < 2 || name.length > 100) {
        ctx.addIssue({ code: "custom", path: ["regimeName"], message: "Enter the regime name" });
      }
    }
    const facts = data.factsNeededHours;
    if (data.regulatoryRegime !== "NONE" && facts != null && (!Number.isInteger(facts) || facts < 1 || facts > 72)) {
      ctx.addIssue({ code: "custom", path: ["factsNeededHours"], message: "Enter a whole number of hours between 1 and 72" });
    }
    // M26 AC2 (moved to Release 1 on 08 Oct 2026): calendar days after resolution.
    const reportDays = data.postIncidentReportDays;
    if (data.regulatoryRegime !== "NONE" && reportDays != null && (!Number.isInteger(reportDays) || reportDays < 1 || reportDays > 90)) {
      ctx.addIssue({ code: "custom", path: ["postIncidentReportDays"], message: "Enter a whole number of days between 1 and 90" });
    }
  });

export type ObligationsInput = z.infer<typeof obligationsSchema>;
