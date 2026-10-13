import { z } from "zod";
import { AssessmentOutcome, CommunicationChannel, CommunicationType, IssueImpact, IssueStatus, IssueType, Scheme, AwarenessSource } from "@prisma/client";

import { REPORT_LINK_HOST } from "@/lib/validation/report-link";
import { ISSUE_REASON_LENGTH } from "@/server/config";

// Brief 3.4.3. One Zod schema per issue action, used by the forms (6B+)
// and the services (authoritative). Copy in double quotes is exact
// (Appendix B). 6A builds the Report and Change-severity/Change-type
// shapes only -- the rest of 3.4.3's rows belong to the owner/
// communicator/partner actions built in 6B/6C.

/** Brief 3.4.3 "Scheme, country" row. Exported: the report drawer also needs this to require/disable the fields client-side. */
export const TYPES_REQUIRING_SCHEME: IssueType[] = ["SERVICE_UNAVAILABLE", "PARTNER_DEGRADED", "WRONG_MATCH", "INTEGRATION_BLOCKER"];

const customerReporterShape = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("CONTACT"), contactId: z.string() }),
  z.object({ kind: z.literal("SOMEONE_ELSE"), name: z.string().trim().min(1).max(120) }),
  z.object({ kind: z.literal("FOUND_INTERNALLY") }),
]);

export const reportIssueSchema = z
  .object({
    productId: z.string().nullable().optional(),
    scheme: z.enum(Scheme).nullable().optional(),
    country: z.string().trim().length(2).toUpperCase().nullable().optional(),
    type: z.enum(IssueType, { error: () => "Select the issue type" }),
    description: z
      .string()
      .trim()
      .min(20, "Describe the issue in 20 to 5,000 characters")
      .max(5000, "Describe the issue in 20 to 5,000 characters"),
    awareAt: z.string(), // ISO instant; order against Event and now() checked on the server (src/server/issues/times.ts)
    awarenessSource: z.enum(AwarenessSource, { error: () => "Select the source" }),
    eventAt: z.string().nullable().optional(), // ISO instant; null or absent = Unknown
    customerReporter: customerReporterShape,
    impact: z.enum(IssueImpact, { error: () => "Select the impact" }),
    possibleBreach: z.boolean({ error: () => "Answer Yes or No" }),
  })
  .superRefine((data, ctx) => {
    const needsScheme = TYPES_REQUIRING_SCHEME.includes(data.type);
    const hasScheme = !!data.scheme;
    const hasCountry = !!data.country;
    if (hasScheme !== hasCountry) {
      ctx.addIssue({ code: "custom", path: ["scheme"], message: "Select the scheme and country affected" });
    } else if (needsScheme && !hasScheme) {
      ctx.addIssue({ code: "custom", path: ["scheme"], message: "Select the scheme and country affected" });
    }
  });

export type ReportIssueInput = z.infer<typeof reportIssueSchema>;

/** Group report (M17 AC4): the same report fields, applied to every ticked entity. */
export const reportGroupIssueSchema = z.object({
  entityIds: z.array(z.string()).min(1, "Select at least one affected entity"),
  report: reportIssueSchema,
});

export type ReportGroupIssueInput = z.infer<typeof reportGroupIssueSchema>;

export const changeSeveritySchema = z.object({
  severity: z.enum(["SEV1", "SEV2", "SEV3", "SEV4"]),
  reason: z
    .string()
    .trim()
    .min(ISSUE_REASON_LENGTH.min, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .max(ISSUE_REASON_LENGTH.max, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`),
  version: z.number().int(),
});

export type ChangeSeverityInput = z.infer<typeof changeSeveritySchema>;

export const changeTypeSchema = z.object({
  type: z.enum(IssueType),
  reason: z
    .string()
    .trim()
    .min(ISSUE_REASON_LENGTH.min, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .max(ISSUE_REASON_LENGTH.max, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`),
  version: z.number().int(),
});

export type ChangeTypeInput = z.infer<typeof changeTypeSchema>;

// ───────────── 6B: owner and communicator actions (M21, M22) ─────────────

/** "Add to existing issue" (M17 AC6): the same report fields, applied as a note on the target. */
export const addReportToExistingSchema = reportIssueSchema;
export type AddReportToExistingInput = ReportIssueInput;

/** M17 AC11, AC13. Reporter only, status New. */
export const editDescriptionSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, "Describe the issue in 20 to 5,000 characters")
    .max(5000, "Describe the issue in 20 to 5,000 characters"),
  version: z.number().int(),
});
export type EditDescriptionInput = z.infer<typeof editDescriptionSchema>;

/** M21 AC1. */
export const acknowledgeIssueSchema = z.object({ version: z.number().int() });
export type AcknowledgeIssueInput = z.infer<typeof acknowledgeIssueSchema>;

/**
 * M21 AC3, AC5. "Resolved" is its own dialog/endpoint (resolveIssueSchema);
 * this schema's `status` is never RESOLVED. Going from Resolved back to
 * In progress requires `reason` (10-500, AC5); any other change takes an
 * optional `note` (0-500, AC3). The service decides which field applies.
 */
export const changeStatusSchema = z.object({
  status: z.enum([IssueStatus.IN_PROGRESS, IssueStatus.WAITING_ON_CUSTOMER, IssueStatus.WAITING_ON_PARTNER]),
  note: z.string().trim().max(500, "Note must be 500 characters or fewer").optional(),
  reason: z
    .string()
    .trim()
    .min(ISSUE_REASON_LENGTH.min, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .max(ISSUE_REASON_LENGTH.max, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .optional(),
  version: z.number().int(),
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

/** M21 AC4. */
export const resolveIssueSchema = z.object({
  rootCause: z.string().trim().min(20, "Enter at least 20 characters").max(2000, "Enter at most 2,000 characters"),
  solution: z.string().trim().min(20, "Enter at least 20 characters").max(2000, "Enter at most 2,000 characters"),
  version: z.number().int(),
  // M23 AC11: a partner issue with active linked issues needs the user
  // to confirm the cascade first. The first call without this flag that
  // would cascade returns a dry-run count instead of resolving; the
  // client re-sends with confirmCascade: true to proceed.
  confirmCascade: z.boolean().optional(),
  // Times rule 7: a Sev-1 with Event unknown needs Event here (root cause report). ISO instant; ignored when Event is already set.
  eventAt: z.string().nullable().optional(),
});
export type ResolveIssueInput = z.infer<typeof resolveIssueSchema>;

/** Times rule 5: "Correct times", owner only. A field left out is not changed; `eventAt: null` sets Event to Unknown. */
export const correctTimesSchema = z.object({
  eventAt: z.string().nullable().optional(),
  awareAt: z.string().optional(),
  awarenessSource: z.enum(AwarenessSource, { error: () => "Select the source" }).optional(),
  reason: z
    .string()
    .trim()
    .min(ISSUE_REASON_LENGTH.min, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .max(ISSUE_REASON_LENGTH.max, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`),
  version: z.number().int(),
});
export type CorrectTimesInput = z.infer<typeof correctTimesSchema>;

/** M21 AC6. */
export const addContributorSchema = z.object({ userId: z.string().min(1), version: z.number().int() });
export type AddContributorInput = z.infer<typeof addContributorSchema>;

export const removeContributorSchema = z.object({ version: z.number().int() });
export type RemoveContributorInput = z.infer<typeof removeContributorSchema>;

/** M21 AC8, AC10. */
export const reassignIssueSchema = z.object({
  newOwnerId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(ISSUE_REASON_LENGTH.min, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`)
    .max(ISSUE_REASON_LENGTH.max, `Reason must be ${ISSUE_REASON_LENGTH.min} to ${ISSUE_REASON_LENGTH.max} characters`),
  version: z.number().int(),
});
export type ReassignIssueInput = z.infer<typeof reassignIssueSchema>;

/** M21 AC7. */
export const addIssueNoteSchema = z.object({
  body: z.string().trim().min(1, "Enter a note").max(5000, "Note must be 5,000 characters or fewer"),
});
export type AddIssueNoteInput = z.infer<typeof addIssueNoteSchema>;

/** M22 AC6, AC7. Person is a contact of the entity (contactId) or free text (personName), never both. */
export const recordCommunicationSchema = z
  .object({
    type: z.enum([CommunicationType.FIRST_NOTIFICATION, CommunicationType.UPDATE]),
    occurredAt: z.string(),
    channel: z.enum(CommunicationChannel),
    contactId: z.string().optional(),
    personName: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().min(10, "Message must be 10 to 5,000 characters").max(5000, "Message must be 10 to 5,000 characters"),
    version: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (!data.contactId && !data.personName) {
      ctx.addIssue({ code: "custom", path: ["contactId"], message: "Select who you notified" });
    }
  });
export type RecordCommunicationInput = z.infer<typeof recordCommunicationSchema>;

/** M22 AC11. Person is a contact of the entity (personContactId) or a free-text name ("Other person"). */
export const closeIssueSchema = z
  .object({
    personContactId: z.string().optional(),
    personName: z.string().trim().min(1).max(120).optional(),
    channel: z.enum(CommunicationChannel),
    occurredAt: z.string(),
    note: z.string().trim().max(500, "Note must be 500 characters or fewer").optional(),
    version: z.number().int(),
  })
  .superRefine((data, ctx) => {
    if (!data.personContactId && !data.personName) {
      ctx.addIssue({ code: "custom", path: ["personContactId"], message: "Select who confirmed the closure" });
    }
  });
export type CloseIssueInput = z.infer<typeof closeIssueSchema>;

const REPORT_LINK_MESSAGE = `Enter a link starting with https://${REPORT_LINK_HOST}/`;

/** https on the internal documents host only. */
export function isReportLink(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname === REPORT_LINK_HOST;
  } catch {
    return false;
  }
}

/** The owner shares a draft of the root cause report: the link (required, internal documents host, 2,048 characters at most) and a summary of 10 to 2,000. */
export const shareDraftSchema = z.object({
  draftLink: z.string().trim().min(1, REPORT_LINK_MESSAGE).max(2048, "Link must be 2,048 characters or fewer").refine(isReportLink, REPORT_LINK_MESSAGE),
  draftSummary: z.string().trim().min(10, "Summary must be 10 to 2,000 characters").max(2000, "Summary must be 10 to 2,000 characters"),
  version: z.number().int(),
});
export type ShareDraftInput = z.infer<typeof shareDraftSchema>;

/** Compliance approves the root cause report before it is sent. The note is optional. */
export const approveReportSchema = z.object({
  note: z.string().trim().max(2000, "Enter at most 2,000 characters").optional(),
});
export type ApproveReportInput = z.infer<typeof approveReportSchema>;

/** Compliance asks for changes: the reason is required (10 to 2,000 characters). The owner prepares a new draft. */
export const requestChangesSchema = z.object({
  reason: z.string().trim().min(10, "Reason must be 10 to 2,000 characters").max(2000, "Reason must be 10 to 2,000 characters"),
});
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;

/** M27 AC5. Sent to is an active Customer-context contact of the entity; the link is optional. */
export const recordReportSentSchema = z.object({
  sentAt: z.string(),
  contactId: z.string().min(1, "Select an active customer contact"),
  channel: z.enum(CommunicationChannel),
  reportUrl: z
    .string()
    .trim()
    .max(2048, "Link must be 2,048 characters or fewer")
    .refine((v) => {
      if (v === "") return true;
      try {
        const u = new URL(v);
        return u.protocol === "https:" && u.hostname === REPORT_LINK_HOST;
      } catch {
        return false;
      }
    }, REPORT_LINK_MESSAGE)
    .optional(),
  summary: z.string().trim().min(10, "Enter at least 10 characters").max(2000, "Summary must be 10 to 2,000 characters"),
  version: z.number().int(),
});
export type RecordReportSentInput = z.infer<typeof recordReportSentSchema>;

/** M25 AC6. */
export const recordAssessmentSchema = z.object({
  outcome: z.enum(AssessmentOutcome),
  rationale: z.string().trim().min(10, "Rationale must be 10 to 1,000 characters").max(1000, "Rationale must be 10 to 1,000 characters"),
});
export type RecordAssessmentInput = z.infer<typeof recordAssessmentSchema>;

/** M23 AC7, AC8. One row per ticked affected customer: either create a new linked issue or attach an existing open one. */
export const createLinkedIssuesSchema = z.object({
  version: z.number().int(),
  rows: z
    .array(
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("CREATE"), entityId: z.string(), productId: z.string().nullable().optional() }),
        z.object({ action: z.literal("ATTACH"), entityId: z.string(), issueId: z.string() }),
      ]),
    )
    .min(1, "Select at least one affected customer"),
});
export type CreateLinkedIssuesInput = z.infer<typeof createLinkedIssuesSchema>;

/** M23 AC14. */
export const unlinkIssueSchema = z.object({
  reason: z.string().trim().min(5, "Reason must be 5 to 500 characters").max(500, "Reason must be 5 to 500 characters"),
});
export type UnlinkIssueInput = z.infer<typeof unlinkIssueSchema>;
