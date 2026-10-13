import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import { createIssue, resolveIssue } from "@/server/services/issue";
import { createLinkedIssues } from "@/server/services/issue-partner";
import { correctIssueTimes } from "@/server/services/issue-times";

/**
 * Three timestamps, against the real services: correcting times (owner only, per-field audit,
 * History in UTC, open deadlines recalculated, met ones untouched), the monitoring lock, inheritance on linked issues and the
 * Resolve requirement.
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });
const created: string[] = [];
let n = 9_820_000;
let seqBefore = 0;

beforeAll(async () => {
  if ((await db.entity.count()) === 0) throw new Error("Database is empty. Run `npm run db:reset` before this test.");
  const [{ last_value }] = await db.$queryRawUnsafe<{ last_value: bigint }[]>("SELECT last_value FROM issue_number_seq");
  seqBefore = Number(last_value);
});
afterEach(async () => {
  const ids = created.splice(0);
  const links = await db.issueLink.findMany({ where: { parentId: { in: ids } }, select: { childId: true } });
  for (const issueId of [...links.map((l) => l.childId), ...ids]) {
    await db.issueTimeCorrection.deleteMany({ where: { issueId } });
    await db.issueContributor.deleteMany({ where: { issueId } });
    await db.issueResolution.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.complianceAssessment.deleteMany({ where: { issueId } });
    await db.rootCauseReportTask.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issueLink.deleteMany({ where: { OR: [{ childId: issueId }, { parentId: issueId }] } });
    await db.issue.delete({ where: { id: issueId } });
  }
});
afterAll(async () => {
  await db.$executeRawUnsafe(`SELECT setval('issue_number_seq', ${seqBefore}, true)`);
  await db.$disconnect();
});

const minutesBefore = (d: Date, m: number) => new Date(d.getTime() - m * 60_000);

async function ownedIssue(over: Record<string, unknown> = {}) {
  const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
  const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
  const opened = minutesBefore(now(), 60);
  const aware = minutesBefore(opened, 10);
  const issue = await db.issue.create({
    data: {
      number: n++, entityId: revolut.id, type: "SERVICE_UNAVAILABLE", impact: "DOWN", possibleBreach: false, proposedSeverity: "SEV2", severity: "SEV2",
      description: "Throwaway issue created by issue-times.test.ts for the Correct times service.",
      awareAt: aware, eventAt: minutesBefore(aware, 20), awarenessSource: "EMAIL", reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS", customerReporterKind: "FOUND_INTERNALLY",
      status: "IN_PROGRESS", createdAt: opened, ownerTeam: "OPS", ownerId: kevin.id, ownerSince: opened, routingRule: "NAMED_PERSON", routingReason: "test fixture",
      communicatorRule: "CUSTOMER_OWNER", clocksStartAt: opened, ackStartAt: aware, ackDueAt: new Date(aware.getTime() + 60 * 60_000),
      notifyRequired: true, notifyStartAt: aware, notifyTargetBusinessMins: 240, notifyDueAt: new Date(aware.getTime() + 240 * 60_000),
      ...over,
    },
  });
  created.push(issue.id);
  return { issue, kevin, opened, aware };
}

describe("reporting: the order is checked on the server", () => {
  it("refuses an Event after Corvane aware at, and a Corvane aware at in the future, before anything is written", async () => {
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const before = await db.issue.count();
    const base = {
      type: "WRONG_MATCH" as const, scheme: "UK_COP" as const, country: "GB", description: "Trade-name payees return No match since this morning.",
      customerReporter: { kind: "FOUND_INTERNALLY" as const }, impact: "DEGRADED" as const, possibleBreach: false, awarenessSource: "EMAIL" as const,
    };
    const aware = minutesBefore(now(), 30);
    await expect(createIssue(emma, revolut.id, { ...base, awareAt: aware.toISOString(), eventAt: new Date(aware.getTime() + 60_000).toISOString() })).rejects.toMatchObject({
      fieldErrors: { eventAt: ["Event can't be after Corvane aware at"], awareAt: ["Corvane aware at can't be before the event"] },
    });
    await expect(createIssue(emma, revolut.id, { ...base, awareAt: new Date(now().getTime() + 3_600_000).toISOString() })).rejects.toMatchObject({
      fieldErrors: { awareAt: ["Corvane aware at can't be in the future"] },
    });
    expect(await db.issue.count()).toBe(before);
  });
});

describe("Correct times", () => {
  it("owner only: anyone else is refused and nothing changes", async () => {
    const { issue } = await ownedIssue();
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    await expect(correctIssueTimes(emma, issue.id, { awarenessSource: "PHONE", reason: "The customer phoned first.", version: issue.version })).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).awarenessSource).toBe("EMAIL");
  });

  it("a correction writes one correction row and one audit entry per field, a History event in UTC, and recalculates the open deadlines", async () => {
    const { issue, kevin, aware, opened } = await ownedIssue();
    const newAware = minutesBefore(opened, 40);
    const newEvent = minutesBefore(newAware, 15);
    await correctIssueTimes(kevin, issue.id, { eventAt: newEvent.toISOString(), awareAt: newAware.toISOString(), awarenessSource: "PHONE", reason: "The customer phoned before the email arrived.", version: issue.version });

    const after = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(after.awareAt).toEqual(newAware);
    expect(after.eventAt).toEqual(newEvent);
    expect(after.awarenessSource).toBe("PHONE");
    expect(after.version).toBe(issue.version + 1);
    expect(after.ackStartAt).toEqual(newAware); // open: recalculated
    expect(after.ackDueAt).toEqual(new Date(newAware.getTime() + 60 * 60_000));
    expect(after.notifyStartAt).toEqual(newAware);

    const rows = await db.issueTimeCorrection.findMany({ where: { issueId: issue.id }, orderBy: { field: "asc" } });
    expect(rows.map((r) => r.field)).toEqual(["AWARE_AT", "AWARENESS_SOURCE", "EVENT_AT"]);
    expect(rows.find((r) => r.field === "AWARE_AT")).toMatchObject({ oldValue: aware.toISOString(), newValue: newAware.toISOString(), reason: "The customer phoned before the email arrived.", correctedById: kevin.id });

    const audit = await db.auditEntry.findMany({ where: { objectId: issue.id, field: { in: ["Event", "Corvane aware at", "Source"] } } });
    expect(audit.map((a) => a.field).sort()).toEqual(["Corvane aware at", "Event", "Source"]);

    const history = await db.historyEvent.findMany({ where: { issueId: issue.id } });
    const sentence = history.find((h) => h.summary.startsWith("Corvane aware at corrected"))!;
    expect(sentence.summary).toContain(" UTC to ");
    expect(sentence.summary).toContain("by Kevin Lim: The customer phoned before the email arrived.");
    expect(sentence.details).toMatchObject({ kind: "TIME_CORRECTION", field: "AWARE_AT", oldValue: aware.toISOString() });
  });

  it("the order rule holds on a correction too: Event after Corvane aware at, and Corvane aware at after Opened, are refused", async () => {
    const { issue, kevin, opened, aware } = await ownedIssue();
    await expect(correctIssueTimes(kevin, issue.id, { eventAt: new Date(aware.getTime() + 60_000).toISOString(), reason: "Wrong event time entered.", version: issue.version })).rejects.toMatchObject({
      fieldErrors: { eventAt: ["Event can't be after Corvane aware at"] },
    });
    await expect(correctIssueTimes(kevin, issue.id, { awareAt: new Date(opened.getTime() + 60_000).toISOString(), reason: "Wrong aware time entered.", version: issue.version })).rejects.toMatchObject({
      fieldErrors: { awareAt: [expect.stringContaining("after the issue was opened")] },
    });
    expect(await db.issueTimeCorrection.count({ where: { issueId: issue.id } })).toBe(0);
  });

  it("a deadline already met stays met: acknowledged and notified keep their start and due time", async () => {
    const base = await ownedIssue();
    const acked = new Date(base.aware.getTime() + 20 * 60_000);
    const notified = new Date(base.aware.getTime() + 90 * 60_000);
    const issue = await db.issue.update({ where: { id: base.issue.id }, data: { acknowledgedAt: acked, acknowledgedById: base.kevin.id, notifiedAt: notified } });
    await correctIssueTimes(base.kevin, issue.id, { awareAt: minutesBefore(base.opened, 15).toISOString(), reason: "The email reached the mailbox earlier.", version: issue.version });
    const after = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(after.ackStartAt).toEqual(base.aware);
    expect(after.ackDueAt).toEqual(base.issue.ackDueAt);
    expect(after.notifyStartAt).toEqual(base.aware);
    expect(after.notifyDueAt).toEqual(base.issue.notifyDueAt);
    expect(after.awareAt).toEqual(minutesBefore(base.opened, 15)); // the time itself is corrected
  });

  it("the clocks of a resolved issue do not change", async () => {
    const base = await ownedIssue({ status: "RESOLVED", resolvedAt: new Date() });
    await correctIssueTimes(base.kevin, base.issue.id, { awareAt: minutesBefore(base.opened, 15).toISOString(), reason: "The email reached the mailbox earlier.", version: base.issue.version });
    const after = await db.issue.findUniqueOrThrow({ where: { id: base.issue.id } });
    expect(after.ackStartAt).toEqual(base.aware);
    expect(after.notifyStartAt).toEqual(base.aware);
  });

  it("monitoring: Corvane aware at is the alert time and can't be corrected; Event can", async () => {
    const base = await ownedIssue({ reporterKind: "MONITORING", reporterId: null, reporterTeam: null, awarenessSource: "MONITORING" });
    await expect(correctIssueTimes(base.kevin, base.issue.id, { awareAt: minutesBefore(base.opened, 15).toISOString(), reason: "Wrong alert time recorded.", version: base.issue.version })).rejects.toMatchObject({
      fieldErrors: { awareAt: [expect.stringContaining("monitoring issue")] },
    });
    const newEvent = minutesBefore(base.aware, 5);
    await correctIssueTimes(base.kevin, base.issue.id, { eventAt: newEvent.toISOString(), reason: "The alert fired 5 min after the start.", version: base.issue.version });
    expect((await db.issue.findUniqueOrThrow({ where: { id: base.issue.id } })).eventAt).toEqual(newEvent);
  });

  it("Event can be set to Unknown, and an empty correction is refused", async () => {
    const { issue, kevin } = await ownedIssue();
    await expect(correctIssueTimes(kevin, issue.id, { reason: "Nothing actually changes here.", version: issue.version })).rejects.toMatchObject({ fieldErrors: { times: [expect.stringContaining("Change at least one")] } });
    await correctIssueTimes(kevin, issue.id, { eventAt: null, reason: "We don't know when it started.", version: issue.version });
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).eventAt).toBeNull();
    expect(await db.issueTimeCorrection.findFirst({ where: { issueId: issue.id, field: "EVENT_AT" } })).toMatchObject({ newValue: null });
  });
});

describe("linked issues take the partner issue's times", () => {
  async function partnerIssue(over: Record<string, unknown> = {}) {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    const opened = minutesBefore(now(), 90);
    const aware = minutesBefore(opened, 10);
    const issue = await db.issue.create({
      data: {
        number: n++, entityId: lloyds.id, scheme: "UK_COP", country: "GB", type: "PARTNER_DEGRADED", impact: "DOWN", possibleBreach: false, proposedSeverity: "SEV1", severity: "SEV1",
        description: "Lloyds CoP responses above 2 seconds and timeouts. Throwaway fixture created by issue-times.test.ts.",
        awareAt: aware, eventAt: minutesBefore(aware, 20), awarenessSource: "EMAIL", reporterKind: "USER", reporterId: lukas.id, reporterTeam: "NETWORK", customerReporterKind: "FOUND_INTERNALLY",
        status: "IN_PROGRESS", createdAt: opened, ownerTeam: "NETWORK", ownerId: lukas.id, ownerSince: opened, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "ISSUE_OWNER_PARTNER", clocksStartAt: opened, ackStartAt: aware, acknowledgedAt: opened, acknowledgedById: lukas.id, notifyRequired: false,
        ...over,
      },
    });
    created.push(issue.id);
    return { issue, lukas, aware, opened };
  }

  async function withChildren(over: Record<string, unknown> = {}) {
    const p = await partnerIssue(over);
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const santander = await db.entity.findFirstOrThrow({ where: { legalName: "Santander UK plc" } });
    const made = await createLinkedIssues(p.lukas, p.issue.id, { version: p.issue.version, rows: [{ action: "CREATE", entityId: revolut.id }, { action: "CREATE", entityId: santander.id }] });
    return { ...p, childIds: made.map((c) => c.id) };
  }

  it("at creation: Event, Corvane aware at and Source come from the partner issue", async () => {
    const p = await withChildren();
    for (const id of p.childIds) {
      const child = await db.issue.findUniqueOrThrow({ where: { id } });
      expect(child.eventAt).toEqual(p.issue.eventAt);
      expect(child.awareAt).toEqual(p.aware);
      expect(child.awarenessSource).toBe("EMAIL");
    }
  }, 20_000);

  it("on every correction of the partner issue; a linked issue has no Correct times of its own", async () => {
    const p = await withChildren();
    const newAware = minutesBefore(p.opened, 30);
    const newEvent = minutesBefore(newAware, 25);
    await correctIssueTimes(p.lukas, p.issue.id, { eventAt: newEvent.toISOString(), awareAt: newAware.toISOString(), awarenessSource: "CHAT", reason: "Found in the partner's status chat.", version: p.issue.version });
    for (const id of p.childIds) {
      const child = await db.issue.findUniqueOrThrow({ where: { id } });
      expect(child.eventAt).toEqual(newEvent);
      expect(child.awareAt).toEqual(newAware);
      expect(child.awarenessSource).toBe("CHAT");
      expect(child.notifyStartAt).toEqual(newAware); // its notification clock follows
      expect(await db.historyEvent.count({ where: { issueId: id, summary: { startsWith: "Event corrected" } } })).toBe(1);
    }
    const childId = p.childIds[0];
    const child = await db.issue.findUniqueOrThrow({ where: { id: childId } });
    await expect(correctIssueTimes(p.lukas, childId, { awarenessSource: "PHONE", reason: "Trying to correct a linked issue.", version: child.version })).rejects.toMatchObject({
      fieldErrors: { times: [expect.stringMatching(/^Times come from ISS-\d+$/)] },
    });
  }, 20_000);

  it("Resolve: a Sev-1 with Event unknown needs it; it can't be after Corvane aware at; the one entered applies to every linked issue", async () => {
    const p = await withChildren({ eventAt: null });
    for (const id of p.childIds) expect((await db.issue.findUniqueOrThrow({ where: { id } })).eventAt).toBeNull();
    const body = { rootCause: "Certificate rotation failed at the partner.", solution: "The partner restored the endpoint.", confirmCascade: true };

    await expect(resolveIssue(p.lukas, p.issue.id, { ...body, version: p.issue.version })).rejects.toMatchObject({ fieldErrors: { eventAt: [expect.stringContaining("Enter when the problem started")] } });
    await expect(resolveIssue(p.lukas, p.issue.id, { ...body, eventAt: new Date(p.aware.getTime() + 60_000).toISOString(), version: p.issue.version })).rejects.toMatchObject({
      fieldErrors: { eventAt: ["Event can't be after Corvane aware at"] },
    });
    expect((await db.issue.findUniqueOrThrow({ where: { id: p.issue.id } })).status).toBe("IN_PROGRESS");

    const entered = minutesBefore(p.aware, 12);
    await resolveIssue(p.lukas, p.issue.id, { ...body, eventAt: entered.toISOString(), version: p.issue.version });
    const parent = await db.issue.findUniqueOrThrow({ where: { id: p.issue.id } });
    expect(parent.status).toBe("RESOLVED");
    expect(parent.eventAt).toEqual(entered);
    for (const id of p.childIds) expect((await db.issue.findUniqueOrThrow({ where: { id } })).eventAt).toEqual(entered);
  }, 30_000);

  it("Resolve with Event already set is unchanged: no Event needed", async () => {
    const p = await partnerIssue();
    await resolveIssue(p.lukas, p.issue.id, { rootCause: "Certificate rotation failed at the partner.", solution: "The partner restored the endpoint.", version: p.issue.version });
    expect((await db.issue.findUniqueOrThrow({ where: { id: p.issue.id } })).eventAt).toEqual(p.issue.eventAt);
  });

  it("a Sev-2 issue resolves with Event unknown", async () => {
    const { issue, kevin } = await ownedIssue({ eventAt: null });
    await resolveIssue(kevin, issue.id, { rootCause: "Trade-name matching is unsupported upstream.", solution: "Raised with the responding bank.", version: issue.version });
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("RESOLVED");
  });
});
