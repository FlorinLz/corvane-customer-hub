import { z } from "zod";
import { ContactContext, ContactRole } from "@prisma/client";

import { isValidAvailability } from "@/lib/validation/availability";
import { EMAIL_RE } from "@/lib/validation/email";
import { E164_RE, normalisePhone } from "@/lib/validation/phone";
import { isValidTimeZone } from "@/lib/validation/timezone";

// Brief 3.4.2 "Contact". Phone required for Incident/Escalation; time
// zone required for Incident/Escalation/Technical; availability required
// for Incident/Escalation (decision B12).
const PHONE_REQUIRED_ROLES: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION];
const TIME_ZONE_REQUIRED_ROLES: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION, ContactRole.TECHNICAL];
const AVAILABILITY_REQUIRED_ROLES: ContactRole[] = [ContactRole.INCIDENT, ContactRole.ESCALATION];

const availabilityShape = z
  .discriminatedUnion("available24x7", [
    z.object({ available24x7: z.literal(true) }),
    z.object({
      available24x7: z.literal(false),
      days: z.array(z.number().int().min(1).max(7)),
      start: z.string(),
      end: z.string(),
    }),
  ])
  .nullable();

const contactFieldsShape = {
  context: z.enum(ContactContext),
  role: z.enum(ContactRole),
  fullName: z.string().trim().min(2, "Enter the full name").max(120, "Enter the full name"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email address")
    .regex(EMAIL_RE, "Enter a valid email address"),
  phone: z.string().trim().nullable().optional(),
  timeZone: z.string().trim().nullable().optional(),
  availability: availabilityShape.optional(),
  jobTitle: z.string().trim().max(120, "Job title must be 120 characters or fewer").nullable().optional(),
};

function checkRoleRequirements(data: { role: ContactRole; phone?: string | null; timeZone?: string | null; availability?: z.infer<typeof availabilityShape> }, ctx: z.RefinementCtx) {
  const phone = data.phone?.trim() || null;
  if (PHONE_REQUIRED_ROLES.includes(data.role) && !phone) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Use international format, for example +447700900123" });
  }
  if (phone && !E164_RE.test(normalisePhone(phone))) {
    ctx.addIssue({ code: "custom", path: ["phone"], message: "Use international format, for example +447700900123" });
  }

  const timeZone = data.timeZone?.trim() || null;
  if (TIME_ZONE_REQUIRED_ROLES.includes(data.role) && !timeZone) {
    ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Select a time zone" });
  }
  if (timeZone && !isValidTimeZone(timeZone)) {
    ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Select a time zone" });
  }

  if (AVAILABILITY_REQUIRED_ROLES.includes(data.role) && !data.availability) {
    ctx.addIssue({ code: "custom", path: ["availability"], message: "Set the availability window" });
  }
  if (data.availability && !isValidAvailability(data.availability)) {
    ctx.addIssue({ code: "custom", path: ["availability"], message: "Set the availability window" });
  }
}

export const addContactSchema = z
  .object({ ...contactFieldsShape, isPrimary: z.boolean().optional(), confirmDuplicate: z.boolean().optional() })
  .superRefine(checkRoleRequirements);

// isPrimary is Add-only: reassigning primary status on an existing
// contact is "Set primary incident" (its own endpoint, out of M5 scope).
export const editContactSchema = z
  .object({
    ...contactFieldsShape,
    status: z.literal("ACTIVE").optional(), // Left -> Active only; Mark as left has its own route (out of R1 scope)
    version: z.number().int(),
  })
  .superRefine(checkRoleRequirements);

export const verifyContactSchema = z.object({ version: z.number().int() });

export type AddContactInput = z.infer<typeof addContactSchema>;
export type EditContactInput = z.infer<typeof editContactSchema>;
export type VerifyContactInput = z.infer<typeof verifyContactSchema>;
