import { db } from "@/server/db";
import type { OnboardingState } from "@/lib/onboarding/content";

const LLOYDS = "Lloyds Bank plc";
const REVOLUT = "Revolut Ltd";
const RESOLVED = ["RESOLVED", "CLOSED"] as const;

/**
 * What the scenario panel needs to know, read from the data (never from clicks): the scenario issues and which steps their data says are
 * done. Scenario 1 is the seeded ISS-1042. Scenario 2's issue is the newest Partner degraded issue on Lloyds Bank plc, UK CoP, GB, that is not itself linked to another.
 */
export async function loadOnboardingState(): Promise<OnboardingState> {
  const [meta, iss1042, partnerIssue, lloyds] = await Promise.all([
    db.demoMeta.findUnique({ where: { id: 1 }, select: { seedVersion: true } }),
    db.issue.findUnique({
      where: { number: 1042 },
      select: {
        id: true,
        resolvedAt: true,
        communications: { where: { type: { in: ["UPDATE", "CLOSURE_CONFIRMED"] } }, select: { type: true } },
        rootCauseTask: { select: { draftSharedAt: true, approvedAt: true, sentAt: true } },
      },
    }),
    db.issue.findFirst({
      // Not a linked issue: Lloyds is also a customer, so fanning out creates a Partner degraded issue for Lloyds itself.
      where: { type: "PARTNER_DEGRADED", scheme: "UK_COP", country: "GB", entity: { legalName: LLOYDS, deletedAt: null }, parentLinks: { none: {} } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, acknowledgedAt: true, createdAt: true, entityId: true },
    }),
    db.entity.findFirst({ where: { legalName: LLOYDS, deletedAt: null }, select: { id: true } }),
  ]);
  const comms = iss1042?.communications ?? [];
  const task = iss1042?.rootCauseTask ?? null;

  let degraded = false;
  let linkedCount = 0;
  let revolutNotified = false;
  if (partnerIssue) {
    const [change, links] = await Promise.all([
      // "Set to Degraded" writes a coverage status change after the issue was opened.
      db.coverageStatusChange.findFirst({
        where: { status: "DEGRADED", createdAt: { gte: partnerIssue.createdAt }, coverage: { scheme: "UK_COP", country: "GB", partnerRole: { entityId: partnerIssue.entityId } } },
        select: { id: true },
      }),
      db.issueLink.findMany({
        where: { parentId: partnerIssue.id, unlinkedAt: null },
        select: { child: { select: { notifiedAt: true, entity: { select: { legalName: true } } } } },
      }),
    ]);
    degraded = !!change;
    linkedCount = links.length;
    revolutNotified = links.some((l) => l.child.entity.legalName === REVOLUT && l.child.notifiedAt !== null);
  }

  return {
    seedVersion: meta?.seedVersion ?? 0,
    scenario1: {
      issueId: iss1042?.id ?? null,
      updateRecorded: comms.some((c) => c.type === "UPDATE"),
      resolved: !!iss1042?.resolvedAt,
      confirmed: comms.some((c) => c.type === "CLOSURE_CONFIRMED"),
      draftShared: !!task?.draftSharedAt,
      approved: !!task?.approvedAt,
      sent: !!task?.sentAt,
    },
    scenario2: {
      partnerEntityId: lloyds?.id ?? null,
      issueId: partnerIssue?.id ?? null,
      acknowledged: !!partnerIssue?.acknowledgedAt,
      degraded,
      linkedCount,
      revolutNotified,
      resolved: !!partnerIssue && (RESOLVED as readonly string[]).includes(partnerIssue.status),
    },
  };
}
