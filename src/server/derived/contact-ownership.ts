import { ContactContext, ContactRole, Team } from "@prisma/client";

import type { DataArea } from "@/server/permissions/matrix";

/**
 * Brief 3.2 notes / M15 AC4: `Contact.ownerTeams` is set from (context,
 * role) on create and on role change only. One pure function so the write
 * path (stores it) and the read path (used to render "Owned by <Team>"
 * before M5, decorative; used for permission checks from M5 on) can never
 * drift apart.
 */
export function contactOwnerTeams(context: ContactContext, role: ContactRole): Team[] {
  if (role === ContactRole.BILLING) return [Team.FINANCE];
  if (context === ContactContext.PARTNER) return [Team.NETWORK];
  if (role === ContactRole.CHAMPION || role === ContactRole.DECISION_MAKER) return [Team.SALES, Team.CS];
  return [Team.OPS];
}

/** The matrix `DataArea` that gates writes to a contact with this (context, role). */
export function contactDataArea(context: ContactContext, role: ContactRole): DataArea {
  if (role === ContactRole.BILLING) return "contact.FINANCE";
  if (context === ContactContext.PARTNER) return "contact.NETWORK";
  if (role === ContactRole.CHAMPION || role === ContactRole.DECISION_MAKER) return "contact.SALES_CS";
  return "contact.OPS";
}
