import type { AuditObjectType, Prisma } from "@prisma/client";

import { formatDateTime } from "@/lib/time-zones";

/**
 * Brief 3.1.3 step 5: "Name and time come from the latest `AuditEntry` for
 * that object." Every `version`-mismatch 409 renders
 * "This <object> was updated by <name> at <time>. Reload to see the
 * latest status." — the exact wording for coverage (brief's own example)
 * reused verbatim for every other object by substituting its noun.
 */
export async function versionConflictMessage(
  tx: Prisma.TransactionClient,
  objectType: AuditObjectType,
  objectId: string,
  noun: string,
): Promise<string> {
  const last = await tx.auditEntry.findFirst({
    where: { objectType, objectId },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return `This ${noun} was changed by someone else. Reload and try again.`;
  return `This ${noun} was updated by ${last.userName} at ${formatDateTime(last.createdAt)}. Reload to see the latest status.`;
}
