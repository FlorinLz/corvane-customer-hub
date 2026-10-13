import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import { createLinkedIssues } from "@/server/services/issue-partner";
import { acknowledgeIssue, createGroupIssues, reassignIssue, resolveIssue } from "@/server/services/issue";
import { approveReport, recordReportSent, shareDraft } from "@/server/services/root-cause-report";
import { installQueryLatency } from "../helpers/pg-latency";

/**
 * Production bug (Neon): resolving a partner issue with 3 linked issues failed every time with Prisma P2028 "expired
 * transaction" (5177 ms of Prisma's 5000 ms). Docker answers each statement in ~1 ms, so nothing local ever showed it.
 * This test puts a database a network hop away under the same services: every SQL statement waits 60 ms (Neon answered in
 * roughly 90 ms each in the incident), and it asserts on what actually caused the failure, the number of statements a
 * transaction issues one after another and the time it therefore holds:
 *   - before the fix the cascade resolve ran 57 statements (3.9 s at 60 ms, over 5 s at Neon's speed);
 *   - after it, ~22 statements, and the count no longer grows with the number of linked issues.
 * (The budget assertions are soft, so one failing run lists every flow that went over, not just the first.)
 * The budgets below sit well under the old numbers, so a loop of per-row queries creeping back in fails here.
 */
const LATENCY_MS = 60;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });
const latency = installQueryLatency(LATENCY_MS);

// createLinkedIssues() and createGroupIssues() draw real numbers from issue_number_seq, as production reporting does.
// Restoring it keeps that side effect from leaking into seed.test.ts's "next number is ISS-1043" (same reason as issues.test.ts).
let seqBefore = 0;

beforeAll(async () => {
  if ((await db.entity.count()) === 0) throw new Error("Database is empty. Run `npm run db:reset` before this test.");
  const [{ last_value }] = await db.$queryRawUnsafe<{ last_value: bigint }[]>("SELECT last_value FROM issue_number_seq");
  seqBefore = Number(last_value);
});

afterAll(async () => {
  latency.uninstall();
  await db.$executeRawUnsafe(`SELECT setval('issue_number_seq', ${seqBefore}, true)`);
  await db.$disconnect();
});

const ROOT = "Gateway overload after a configuration change, confirmed with the partner's ops team.";
const FIX = "The partner rolled the change back; response times are back under one second.";

/** Prisma's own default for an interactive transaction: what production hit. */
const OLD_DEFAULT_TIMEOUT_MS = 5000;

async function measured<T>(fn: () => Promise<T>) {
  latency.reset();
  const started = Date.now();
  const result = await fn();
  const tx = latency.biggest();
  expect(tx, "the write ran one transaction").not.toBeNull();
  return { result, tx: tx!, totalMs: Date.now() - started };
}

describe(`cascade write paths with ${LATENCY_MS} ms per statement`, () => {
  it("create linked issues (3), acknowledge, reassign, resolve with the cascade and record a report: few statements each, all well inside the old 5 s", async () => {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    const nora = await db.user.findFirstOrThrow({ where: { name: "Nora Lee" } }); // Network, so the issue can be reassigned to her
    const customers = await Promise.all(["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"].map((n) => db.entity.findFirstOrThrow({ where: { legalName: n } })));
    const awareAt = new Date(now().getTime() - 3_600_000);
    const parent = await db.issue.create({
      data: {
        number: 9_900_001, entityId: lloyds.id, scheme: "UK_COP", country: "GB", type: "PARTNER_DEGRADED", impact: "DOWN", possibleBreach: false,
        proposedSeverity: "SEV1", severity: "SEV1",
        description: "Latency test fixture: a partner outage created by a throwaway test, so the cascade can be timed.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: lukas.id, reporterTeam: "NETWORK", customerReporterKind: "FOUND_INTERNALLY", status: "NEW",
        ownerTeam: "NETWORK", ownerId: lukas.id, ownerSince: awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "ISSUE_OWNER_PARTNER", clocksStartAt: awareAt, ackStartAt: awareAt, ackDueAt: new Date(awareAt.getTime() + 15 * 60_000), notifyRequired: false,
      },
    });

    try {
      // Create the 3 linked issues in one request.
      const linked = await measured(() => createLinkedIssues(lukas, parent.id, { version: parent.version, rows: customers.map((e) => ({ action: "CREATE" as const, entityId: e.id })) }));
      expect(linked.result).toHaveLength(3);
      expect.soft(linked.tx.statements, "create linked issues: statements in the transaction").toBeLessThanOrEqual(16); // was 41
      expect.soft(linked.tx.durationMs).toBeLessThan(OLD_DEFAULT_TIMEOUT_MS / 2);
      expect(await db.issueLink.count({ where: { parentId: parent.id, kind: "CREATED", unlinkedAt: null } })).toBe(3);

      // Acknowledge: the children follow (New to In progress).
      let current = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      const ack = await measured(() => acknowledgeIssue(lukas, parent.id, { version: current.version }));
      expect.soft(ack.tx.statements, "acknowledge: statements in the transaction").toBeLessThanOrEqual(12); // was 15
      expect((await db.issue.findMany({ where: { parentLinks: { some: { parentId: parent.id } } }, select: { status: true } })).map((c) => c.status)).toEqual(["IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"]);

      // Reassign: the children follow the new owner.
      current = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      const reassign = await measured(() => reassignIssue(lukas, parent.id, { newOwnerId: nora.id, reason: "Nora takes over the partner follow-up.", version: current.version }));
      expect.soft(reassign.tx.statements, "reassign: statements in the transaction").toBeLessThanOrEqual(15); // was 20
      expect(await db.issue.count({ where: { parentLinks: { some: { parentId: parent.id } }, ownerId: nora.id } })).toBe(3);

      // The incident: resolve with the cascade.
      current = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      const resolved = await measured(() => resolveIssue(nora, parent.id, { rootCause: ROOT, solution: FIX, version: current.version, confirmCascade: true }));
      expect(resolved.tx.committed).toBe(true);
      expect.soft(resolved.tx.statements, "resolve with the cascade: statements in the transaction").toBeLessThanOrEqual(26); // was 57
      expect.soft(resolved.tx.durationMs, "resolve with the cascade: time the transaction was open").toBeLessThan(OLD_DEFAULT_TIMEOUT_MS / 2); // was 3.9 s here, over 5 s on Neon

      // And it is still atomic and complete: every child resolved, a task on each (UK FCA, Sev-1), none on the partner issue.
      const children = await db.issue.findMany({ where: { parentLinks: { some: { parentId: parent.id } } }, select: { id: true, status: true } });
      expect(children.map((c) => c.status)).toEqual(["RESOLVED", "RESOLVED", "RESOLVED"]);
      expect(await db.rootCauseReportTask.count({ where: { issueId: { in: children.map((c) => c.id) } } })).toBe(3);
      expect(await db.rootCauseReportTask.count({ where: { issueId: parent.id } })).toBe(0);
      expect(await db.issueResolution.count({ where: { issueId: { in: children.map((c) => c.id) }, cascadedFromIssueId: parent.id } })).toBe(3);
      expect(await db.issueContributor.count({ where: { issueId: { in: children.map((c) => c.id) }, addedForReport: true } })).toBe(3);

      // The owner shares a draft on one of them, Compliance approves it, then the report is recorded.
      const first = await db.issue.findUniqueOrThrow({ where: { id: children[0].id } });
      const drafted = await measured(() => shareDraft(nora, first.id, { draftLink: "https://docs.corvane-internal.example/reports/draft-1.pdf", draftSummary: "Cause, impact and corrective actions of the outage.", version: first.version }));
      expect.soft(drafted.tx.statements, "share draft: statements in the transaction").toBeLessThanOrEqual(10);
      const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
      const approved = await measured(() => approveReport(mei, children[0].id, { note: "Approved." }));
      expect.soft(approved.tx.statements, "approve report: statements in the transaction").toBeLessThanOrEqual(10);
      const child = await db.issue.findUniqueOrThrow({ where: { id: children[0].id } });
      const contact = await db.contact.findFirstOrThrow({ where: { entityId: child.entityId, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
      const sent = await measured(() => recordReportSent(nora, child.id, { sentAt: now().toISOString(), contactId: contact.id, channel: "EMAIL", summary: "Cause, impact and corrective actions of the outage.", version: child.version }));
      expect.soft(sent.tx.statements, "record report sent: statements in the transaction").toBeLessThanOrEqual(14);
    } finally {
      const links = await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } });
      const ids = [...links.map((l) => l.childId), parent.id];
      for (const id of ids) {
        await db.rootCauseReportTask.deleteMany({ where: { issueId: id } });
        await db.issueContributor.deleteMany({ where: { issueId: id } });
        await db.issueResolution.deleteMany({ where: { issueId: id } });
        await db.issueNote.deleteMany({ where: { issueId: id } });
        await db.issueCommunication.deleteMany({ where: { issueId: id } });
        await db.complianceAssessment.deleteMany({ where: { issueId: id } });
        await db.historyEvent.deleteMany({ where: { issueId: id } });
      }
      await db.issueLink.deleteMany({ where: { parentId: parent.id } });
      for (const id of ids.reverse()) await db.issue.delete({ where: { id } });
    }
  }, 120_000);

  it("a group report on the 4 Santander entities: one issue each, still a bounded number of statements and committed", async () => {
    const group = await db.group.findFirstOrThrow({ where: { name: "Santander" }, include: { entities: { select: { id: true } } } });
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    expect(group.entities).toHaveLength(4);
    let issueIds: string[] = [];
    try {
      const created = await measured(() =>
        createGroupIssues(emma, group.id, {
          entityIds: group.entities.map((e) => e.id),
          report: {
            type: "WRONG_MATCH", impact: "DEGRADED", possibleBreach: false, description: "Latency test: one group report on every Santander entity.",
            awareAt: new Date(now().getTime() - 3_600_000).toISOString(), customerReporter: { kind: "FOUND_INTERNALLY" },
          } as never,
        }),
      );
      issueIds = created.result.map((i) => i.id);
      expect(issueIds).toHaveLength(4);
      expect(await db.issue.count({ where: { id: { in: issueIds }, groupReportId: { not: null } } })).toBe(4); // the group report id goes in with the insert
      expect(created.tx.committed).toBe(true);
      // Each issue is still routed on its own (about 13 statements each; was 59 for the four). A per-member update on top, or any new per-row query, shows here.
      expect.soft(created.tx.statements, "group report of 4: statements in the transaction").toBeLessThanOrEqual(58);
    } finally {
      for (const issueId of issueIds) {
        await db.issueContributor.deleteMany({ where: { issueId } });
        await db.historyEvent.deleteMany({ where: { issueId } });
        await db.issue.delete({ where: { id: issueId } });
      }
      await db.issueGroupReport.deleteMany({ where: { groupId: group.id, issues: { none: {} } } });
    }
  }, 120_000);
});
