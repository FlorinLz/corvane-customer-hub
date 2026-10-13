import type { Prisma, Severity } from "@prisma/client";

import { isInBusinessHours, nextBusinessStart, teamCalendar } from "@/lib/business-hours";
import { issueTeamMember, onCallAt, type RoutingPerson } from "@/server/issues/routing";

// Brief 4.9.9, M25 AC4, edge case 6. Chosen once, the first time an
// issue's Compliance flag is set (the flag and its assessor are sticky
// -- a later severity/type change never moves the assessor). The owner
// and the communicator never change because of this.

export interface ComplianceAssessorResult {
  assessorId: string | null;
  /** Set only when the assessor is the named person but the flag was set outside Compliance hours below Sev-1 (rule 4): the issue stays out of their "Issues" section until this instant. */
  visibleFrom: Date | null;
}

/**
 * `prefetched` lets a caller that chooses for several entities in one transaction (create linked issues) hand in what it
 * already read: the entity's named Compliance person, and a (memoised) on-call lookup, so each choice costs no round trip.
 */
export async function chooseComplianceAssessor(
  tx: Prisma.TransactionClient,
  entityId: string,
  severity: Severity,
  now: Date,
  prefetched?: { named: RoutingPerson | null; onCall: () => Promise<RoutingPerson | null> },
): Promise<ComplianceAssessorResult> {
  const named = prefetched ? prefetched.named : await issueTeamMember(tx, entityId, "COMPLIANCE");
  const cal = teamCalendar("COMPLIANCE", named);

  if (isInBusinessHours(now, cal)) {
    return { assessorId: named?.id ?? null, visibleFrom: null };
  }
  if (severity === "SEV1") {
    const onCall = prefetched ? await prefetched.onCall() : await onCallAt(tx, "COMPLIANCE", now);
    return { assessorId: onCall?.id ?? named?.id ?? null, visibleFrom: null };
  }
  return { assessorId: named?.id ?? null, visibleFrom: named ? nextBusinessStart(now, cal) : null };
}
