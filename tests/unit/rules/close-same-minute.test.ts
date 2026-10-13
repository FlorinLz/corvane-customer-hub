import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import { closeIssue } from "@/server/services/issue-communication";

/**
 * The Close dialog takes minutes, so the time it prefills ("now", to the minute) is at or before the second the issue was
 * resolved in. Closing right after resolving must work (Lukas resolves, then Adrian closes immediately in the demo): the server
 * compares at minute precision. "Not in the future" and "not before the resolution minute" still hold.
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });
const created: string[] = [];
let n = 9_810_000;

beforeAll(async () => {
  if ((await db.entity.count()) === 0) throw new Error("Database is empty. Run `npm run db:reset` before this test.");
});
afterEach(async () => {
  for (const issueId of created.splice(0)) {
    await db.issueCommunication.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }
});
afterAll(async () => {
  await db.$disconnect();
});

const floorMinute = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000);

async function resolvedIssue() {
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
  const adrian = await db.user.findFirstOrThrow({ where: { name: "Adrian Koh" } }); // Revolut's owner: the communicator
  const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
  const resolvedAt = new Date(floorMinute(now()).getTime() + 37_000); // 37 s into the minute, as a real resolution is
  const issue = await db.issue.create({
    data: {
      number: n++, entityId: revolut.id, type: "SERVICE_UNAVAILABLE", impact: "DOWN", possibleBreach: false, proposedSeverity: "SEV2", severity: "SEV2",
      description: "Throwaway same-minute close fixture created by close-same-minute.test.ts.",
      awareAt: new Date(resolvedAt.getTime() - 3_600_000), eventAt: new Date(resolvedAt.getTime() - 4_800_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS", customerReporterKind: "FOUND_INTERNALLY",
      status: "RESOLVED", resolvedAt, ownerTeam: "OPS", ownerId: kevin.id, ownerSince: resolvedAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
      communicatorRule: "CUSTOMER_OWNER", clocksStartAt: resolvedAt, ackStartAt: resolvedAt, acknowledgedAt: resolvedAt, notifyRequired: false,
    },
  });
  created.push(issue.id);
  return { issue, adrian, resolvedAt };
}

describe("Confirm resolution with the customer, right after the resolution", () => {
  it("saves a time in the same minute as the resolution (the minute, which is before its seconds)", async () => {
    const { issue, adrian, resolvedAt } = await resolvedIssue();
    await closeIssue(adrian, issue.id, { personName: "Priya Nair", channel: "EMAIL", occurredAt: floorMinute(resolvedAt).toISOString(), version: issue.version });
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("CLOSED");
  });

  it("still refuses a time in an earlier minute than the resolution, and a time in the future", async () => {
    const { issue, adrian, resolvedAt } = await resolvedIssue();
    const earlier = new Date(floorMinute(resolvedAt).getTime() - 60_000);
    await expect(closeIssue(adrian, issue.id, { personName: "Priya Nair", channel: "EMAIL", occurredAt: earlier.toISOString(), version: issue.version })).rejects.toMatchObject({
      fieldErrors: { occurredAt: [expect.stringContaining("can't be before Resolved at")] },
    });
    await expect(
      closeIssue(adrian, issue.id, { personName: "Priya Nair", channel: "EMAIL", occurredAt: new Date(now().getTime() + 3_600_000).toISOString(), version: issue.version }),
    ).rejects.toMatchObject({ fieldErrors: { occurredAt: ["The time can't be in the future"] } });
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("RESOLVED");
  });
});
