import type { IssueStatus, IssueType, Scheme, Severity, Team } from "@prisma/client";

import { db } from "@/server/db";
import { daysBetween, toLocalDate, today } from "@/lib/dates";
import { ISSUE_OPEN_FOR_SIMILAR } from "@/server/config";

// Brief M17 AC5, edge case 4. Not `cache()`-wrapped: called live from the
// report drawer on scheme/country/product-line change, not at page load.

export interface SimilarIssueRow {
  id: string;
  number: number;
  type: IssueType;
  severity: Severity;
  status: IssueStatus;
  ownerName: string | null;
  ownerTeam: Team | null;
  ageDays: number;
}

/** "Both empty matches both empty" (edge case 4): `null` for either filter matches a `null` column exactly. */
export async function loadSimilarIssues(entityId: string, scheme: Scheme | null, country: string | null): Promise<SimilarIssueRow[]> {
  const rows = await db.issue.findMany({
    where: { entityId, status: { in: ISSUE_OPEN_FOR_SIMILAR }, scheme, country },
    include: { owner: { select: { name: true, team: true } } },
    orderBy: { createdAt: "desc" },
  });

  const t = today();
  return rows.map((r) => {
    const rawAgeDays = daysBetween(toLocalDate(r.createdAt), t);
    // Safety net, not the fix: every write that sets createdAt uses the demo
    // clock (see DECISIONS.md), so this should never actually be negative --
    // if it is, something was written with the wrong clock, and the age
    // shown to the user is clamped at 0 rather than a confusing negative.
    if (rawAgeDays < 0) {
      console.warn(`[issue-similar] ISS-${r.number}'s createdAt is ${-rawAgeDays} day(s) ahead of the demo clock's "today"`);
    }
    return {
      id: r.id,
      number: r.number,
      type: r.type,
      severity: r.severity,
      status: r.status,
      ownerName: r.owner?.name ?? null,
      ownerTeam: r.owner?.team ?? null,
      ageDays: Math.max(0, rawAgeDays),
    };
  });
}
