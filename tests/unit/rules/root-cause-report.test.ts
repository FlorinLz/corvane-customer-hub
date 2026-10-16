import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { now } from "@/lib/dates";
import { addBusinessMinutes, teamCalendar } from "@/lib/business-hours";
import { approveReportSchema, recordReportSentSchema, requestChangesSchema, shareDraftSchema } from "@/lib/validation/issues";
import { loadWorklistIssues } from "@/server/queries/worklist/issues";
import { reassignIssue, resolveIssue } from "@/server/services/issue";
import { approveReport, recordReportSent, requestChanges, shareDraft } from "@/server/services/root-cause-report";
import { closeIssue } from "@/server/services/issue-communication";

/**
 * Root cause report task (M27 AC1 to AC7, Release 1). Needs the database reset with the frozen-clock seed (see
 * rules/issues.test.ts). Every test works on a throwaway Sev-1 customer issue, never the seeded ISS-1031/1038/1042.
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });

const created: string[] = [];
let issueNumber = 9_800_000;
const ROOT = "Gateway overload after a configuration change, confirmed with the partner's ops team.";
const FIX = "The partner rolled the change back; response times are back under one second.";

beforeAll(async () => {
  if ((await db.entity.count()) === 0) throw new Error("Database is empty. Run `npm run db:reset` before this test.");
});

afterEach(async () => {
  for (const issueId of created.splice(0)) {
    await db.rootCauseReportTask.deleteMany({ where: { issueId } });
    await db.issueContributor.deleteMany({ where: { issueId } });
    await db.issueResolution.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.issueCommunication.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

const user = (name: string) => db.user.findFirstOrThrow({ where: { name } });

/** An acknowledged, In progress customer issue owned by Kevin Lim (Ops). */
async function createIssue(entityName: string, over: { severity?: "SEV1" | "SEV2"; communicatorRule?: "CUSTOMER_OWNER" | "ISSUE_OWNER_PARTNER"; type?: "SERVICE_UNAVAILABLE" | "PARTNER_DEGRADED" } = {}) {
  const entity = await db.entity.findFirstOrThrow({ where: { legalName: entityName } });
  const kevin = await user("Kevin Lim");
  const t = now();
  const issue = await db.issue.create({
    data: {
      number: issueNumber++,
      entityId: entity.id, type: over.type ?? "SERVICE_UNAVAILABLE", impact: "DOWN", possibleBreach: false,
      proposedSeverity: over.severity ?? "SEV1", severity: over.severity ?? "SEV1",
      description: "Throwaway root cause report fixture created by root-cause-report.test.ts.",
      awareAt: new Date(t.getTime() - 3_600_000), eventAt: new Date(t.getTime() - 4_800_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS",
      customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
      ownerTeam: "OPS", ownerId: kevin.id, ownerSince: t, routingRule: "NAMED_PERSON", routingReason: "test fixture",
      communicatorRule: over.communicatorRule ?? "CUSTOMER_OWNER",
      clocksStartAt: new Date(t.getTime() - 3_600_000), ackStartAt: new Date(t.getTime() - 3_600_000), acknowledgedAt: new Date(t.getTime() - 3_000_000), notifyRequired: false,
    },
  });
  created.push(issue.id);
  return { issue, kevin, entity };
}

const DRAFT = { draftLink: "https://docs.corvane-internal.example/reports/draft-1.pdf", draftSummary: "Cause, impact and corrective actions of the outage (draft 1)." };

/** The owner shares a draft (the first of the three steps). */
async function share(issueId: string, over: Partial<typeof DRAFT> = {}) {
  const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
  const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
  return shareDraft(owner, issueId, { ...DRAFT, ...over, version: issue.version });
}

/** Compliance approves the report (Mei Chen unless another approver is given), after the owner shared a draft: the owner can send it only after this. */
async function approve(issueId: string, approver?: Awaited<ReturnType<typeof user>>, note?: string) {
  if (!(await taskOf(issueId))!.draftSharedAt) await share(issueId);
  return approveReport(approver ?? (await user("Mei Chen")), issueId, { note });
}

async function resolve(issueId: string, owner: { id: string }) {
  const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
  const ownerUser = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
  return resolveIssue(ownerUser, issueId, { rootCause: ROOT, solution: FIX, version: issue.version });
}

const DAY = 24 * 3_600_000;
const taskOf = (issueId: string) => db.rootCauseReportTask.findUnique({ where: { issueId } });

/** Every line of a Home row, line 1 then line 2: what the row names as somebody's step ("Kevin Lim: Share the draft"), own or waiting. */
function rowLines(row: { view: { line1: { kind: string; label?: string; person?: string }; line2: { person: string; label: string }[] } }) {
  const first = row.view.line1;
  return [...(first.kind === "none" ? [] : [{ kind: first.kind, person: first.person ?? "", label: first.label ?? "" }]), ...row.view.line2.map((l) => ({ kind: "other", person: l.person, label: l.label }))];
}

// A Home load reads every issue with its communications and assessments; the longest test here loads Home five times against a real database.
vi.setConfig({ testTimeout: 30_000 });

describe("task creation (M27 AC1 to AC3)", () => {
  it("Sev-1 on a regulated customer: the deadline is the resolution time + the card's days (Revolut 14), read once; Compliance joins as contributor; History and audit written", async () => {
    const { issue, kevin } = await createIssue("Revolut Ltd");
    await resolve(issue.id, kevin);

    const resolved = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    const task = await taskOf(issue.id);
    expect(task).not.toBeNull();
    expect(task!.reportDays).toBe(14);
    expect(task!.dueAt!.getTime()).toBe(resolved.resolvedAt!.getTime() + 14 * DAY);
    expect(task!.sentAt).toBeNull();
    expect(Math.abs(task!.createdAt.getTime() - resolved.resolvedAt!.getTime())).toBeLessThan(1000); // the demo clock, not the database's own

    const mei = await user("Mei Chen"); // Revolut's named Compliance person
    const contributor = await db.issueContributor.findFirstOrThrow({ where: { issueId: issue.id, userId: mei.id } });
    expect(contributor.addedForReport).toBe(true);

    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report task created" } } });
    expect(history.category).toBe("INCIDENT");
    expect(history.summary).toMatch(/^Root cause report task created, due \d\d \w{3} 2026$/);
    expect(Math.abs(history.createdAt.getTime() - resolved.resolvedAt!.getTime())).toBeLessThan(1000);
    const fields = (await db.auditEntry.findMany({ where: { objectId: issue.id, createdAt: { gte: resolved.resolvedAt! } } })).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["Root cause report task", "Root cause report due", "Post-incident report due (days)", "Contributor"]));
  });

  it("other customers read their own days: Santander UK 30, MPS 20", async () => {
    for (const [name, days] of [["Santander UK plc", 30], ["Banca Monte dei Paschi di Siena S.p.A.", 20]] as const) {
      const { issue, kevin } = await createIssue(name);
      await resolve(issue.id, kevin);
      expect((await taskOf(issue.id))!.reportDays).toBe(days);
    }
  });

  it("Lloyds Bank plc's customer card reads 14 days (the partner issue itself gets no task, AC1)", async () => {
    const { issue, kevin } = await createIssue("Lloyds Bank plc");
    await resolve(issue.id, kevin);
    expect((await taskOf(issue.id))!.reportDays).toBe(14);

    const partner = await createIssue("Lloyds Bank plc", { communicatorRule: "ISSUE_OWNER_PARTNER", type: "PARTNER_DEGRADED" });
    await resolve(partner.issue.id, partner.kevin);
    expect(await taskOf(partner.issue.id)).toBeNull();
  });

  it("severity lowered before resolution: no task (edge case 1)", async () => {
    const { issue, kevin } = await createIssue("Revolut Ltd", { severity: "SEV2" });
    await resolve(issue.id, kevin);
    expect(await taskOf(issue.id)).toBeNull();
    expect(await db.issueContributor.count({ where: { issueId: issue.id } })).toBe(0);
  });

  it("regime None creates nothing; regime not captured creates nothing (the issue page shows the muted line, AC2)", async () => {
    for (const name of ["Nordea Bank Abp", "Monzo Bank Ltd"]) {
      const { issue, kevin } = await createIssue(name);
      await resolve(issue.id, kevin);
      expect(await taskOf(issue.id), name).toBeNull();
    }
  });

  it("no days captured: the task is due in 10 business days of the owner's calendar (the deadline model's default)", async () => {
    const adyen = await db.entity.findFirstOrThrow({ where: { legalName: "Adyen N.V." } });
    const card = await db.obligationCard.findUniqueOrThrow({ where: { entityId_kind: { entityId: adyen.id, kind: "CUSTOMER_AGREEMENT" } } });
    await db.obligationCard.update({ where: { id: card.id }, data: { postIncidentReportDays: null } });
    try {
      const { issue, kevin } = await createIssue("Adyen N.V.");
      await resolve(issue.id, kevin);
      const task = await taskOf(issue.id);
      expect(task).not.toBeNull();
      expect(task!.reportDays).toBeNull(); // the card named none: the default is not written into it
      expect(task!.dueAt).not.toBeNull();
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! }, select: { timeZone: true, team: true } });
      const expected = addBusinessMinutes(task!.createdAt, 10 * 540, teamCalendar(issue.ownerTeam, owner));
      expect(task!.dueAt!.getTime()).toBe(expected.getTime());
      const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report task created" } } });
      expect(history.summary).toMatch(/^Root cause report task created, due /);
    } finally {
      await db.obligationCard.update({ where: { id: card.id }, data: { postIncidentReportDays: card.postIncidentReportDays } });
    }
  });

  it("a card value changed after creation leaves the deadline alone (edge case 3); a second resolution creates no second task (AC6)", async () => {
    const { issue, kevin, entity } = await createIssue("Revolut Ltd");
    await resolve(issue.id, kevin);
    const first = await taskOf(issue.id);
    const card = await db.obligationCard.findUniqueOrThrow({ where: { entityId_kind: { entityId: entity.id, kind: "CUSTOMER_AGREEMENT" } } });
    await db.obligationCard.update({ where: { id: card.id }, data: { postIncidentReportDays: 30 } });
    try {
      // Back to work, then resolved again.
      await db.issue.update({ where: { id: issue.id }, data: { status: "IN_PROGRESS", version: { increment: 1 } } });
      await resolve(issue.id, kevin);
      const again = await taskOf(issue.id);
      expect(again!.id).toBe(first!.id);
      expect(again!.dueAt!.getTime()).toBe(first!.dueAt!.getTime());
      expect(again!.reportDays).toBe(14);
      expect(await db.rootCauseReportTask.count({ where: { issueId: issue.id } })).toBe(1);
    } finally {
      await db.obligationCard.update({ where: { id: card.id }, data: { postIncidentReportDays: card.postIncidentReportDays } });
    }
  });

  it("a Compliance person already on the issue is not added twice and is not marked as added for the report", async () => {
    const { issue, kevin } = await createIssue("Revolut Ltd");
    const mei = await user("Mei Chen");
    await db.issueContributor.create({ data: { issueId: issue.id, userId: mei.id } });
    await resolve(issue.id, kevin);
    const rows = await db.issueContributor.findMany({ where: { issueId: issue.id, userId: mei.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].addedForReport).toBe(false);
  });
});

describe("Record report sent (M27 AC5, AC7)", () => {
  async function resolvedWithTask() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } });
    const contact = await db.contact.findFirstOrThrow({ where: { entityId: fx.entity.id, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
    return { ...fx, issue, contact };
  }
  const input = (issue: { version: number }, contactId: string, over: Record<string, unknown> = {}) => ({
    sentAt: now().toISOString(),
    contactId,
    channel: "EMAIL" as const,
    summary: "Cause, impact and corrective actions of the partner outage.",
    version: issue.version,
    ...over,
  });

  it("anyone but the owner gets 403 not_issue_owner and nothing is written", async () => {
    const { issue, contact } = await resolvedWithTask();
    for (const name of ["Adrian Koh", "Mei Chen", "Rachel Wong"]) {
      await expect(recordReportSent(await user(name), issue.id, input(issue, contact.id)), name).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
    }
    expect((await taskOf(issue.id))!.sentAt).toBeNull();
    expect(await db.issueCommunication.count({ where: { issueId: issue.id, type: "ROOT_CAUSE_REPORT_SENT" } })).toBe(0);
  });

  it("the owner records it: task, communication log, History 'under Incident' and audit entries, all from the demo clock", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await approve(issue.id);
    await recordReportSent(kevin, issue.id, input(issue, contact.id, { reportUrl: "https://docs.corvane-internal.example/reports/iss-1.pdf" }));

    const task = (await taskOf(issue.id))!;
    expect(task.sentAt).not.toBeNull();
    expect(task.sentToName).toBe(contact.fullName);
    expect(task.sentById).toBe(kevin.id);
    expect(task.channel).toBe("EMAIL");
    expect(task.reportUrl).toBe("https://docs.corvane-internal.example/reports/iss-1.pdf");

    const log = await db.issueCommunication.findFirstOrThrow({ where: { issueId: issue.id, type: "ROOT_CAUSE_REPORT_SENT" } });
    expect(log.personName).toBe(contact.fullName);
    expect(log.recordedByName).toBe("Kevin Lim");
    expect(Math.abs(log.createdAt.getTime() - now().getTime())).toBeLessThan(10_000);

    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report sent" } } });
    expect(history.category).toBe("INCIDENT");
    expect(history.summary).toBe(`Root cause report sent to ${contact.fullName} (Revolut Ltd). By Kevin Lim, Ops.`);
    expect(Math.abs(history.createdAt.getTime() - now().getTime())).toBeLessThan(10_000);
    const fields = (await db.auditEntry.findMany({ where: { objectId: issue.id, field: { startsWith: "Report" } } })).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["Report sent to", "Report channel", "Report link", "Report summary", "Report sent by"]));

    // Recording twice is refused.
    const fresh = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    await expect(recordReportSent(kevin, issue.id, input(fresh, contact.id))).rejects.toMatchObject({ fieldErrors: { task: ["The root cause report is already recorded"] } });
  });

  it("rejects a time in the future, a time before the resolution, and a contact that is not an active Customer-context contact of the entity", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await approve(issue.id);
    await expect(recordReportSent(kevin, issue.id, input(issue, contact.id, { sentAt: new Date(now().getTime() + 3_600_000).toISOString() }))).rejects.toMatchObject({ fieldErrors: { sentAt: ["The time can't be in the future"] } });
    await expect(recordReportSent(kevin, issue.id, input(issue, contact.id, { sentAt: new Date(issue.resolvedAt!.getTime() - 60_000).toISOString() }))).rejects.toMatchObject({ fieldErrors: { sentAt: [expect.stringContaining("can't be before Resolved at")] } });
    const other = await db.contact.findFirstOrThrow({ where: { entityId: { not: issue.entityId }, context: "CUSTOMER", status: "ACTIVE" } });
    await expect(recordReportSent(kevin, issue.id, input(issue, other.id))).rejects.toMatchObject({ fieldErrors: { contactId: ["Select an active customer contact"] } });
    expect((await taskOf(issue.id))!.sentAt).toBeNull();
  });

  it("Record report sent is rejected until the owner shared a draft and Compliance approved it; the owner is checked first (403 before the business rule)", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await expect(recordReportSent(kevin, issue.id, input(issue, contact.id))).rejects.toMatchObject({ fieldErrors: { task: ["Share the draft of the report first"] } });
    await share(issue.id);
    await expect(recordReportSent(kevin, issue.id, input(issue, contact.id))).rejects.toMatchObject({ fieldErrors: { task: ["Compliance must approve the report before it is sent"] } });
    await expect(recordReportSent(await user("Adrian Koh"), issue.id, input(issue, contact.id))).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
    expect((await taskOf(issue.id))!.sentAt).toBeNull();
    await approve(issue.id);
    await recordReportSent(kevin, issue.id, input(issue, contact.id));
    expect((await taskOf(issue.id))!.sentAt).not.toBeNull();
  });

  it("the link: https on docs.corvane-internal.example only, 2,048 characters at most; the summary 10 to 2,000", () => {
    const base = { sentAt: new Date().toISOString(), contactId: "c1", channel: "EMAIL", summary: "A summary that is long enough.", version: 0 };
    const ok = (reportUrl?: string, summary = base.summary) => recordReportSentSchema.safeParse({ ...base, reportUrl, summary }).success;
    expect(ok()).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok("https://docs.corvane-internal.example/reports/a.pdf")).toBe(true);
    expect(ok("http://docs.corvane-internal.example/reports/a.pdf")).toBe(false);
    expect(ok("https://evil.example/reports/a.pdf")).toBe(false);
    expect(ok("https://docs.corvane-internal.example.evil.example/a")).toBe(false);
    expect(ok(`https://docs.corvane-internal.example/${"a".repeat(2048)}`)).toBe(false);
    expect(ok(undefined, "Too short")).toBe(false);
    expect(ok(undefined, "x".repeat(2001))).toBe(false);
    expect(ok(undefined, "x".repeat(2000))).toBe(true);
  });
});

describe("The owner shares a draft (step 1 of 3)", () => {
  async function resolvedWithTask() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    return { ...fx, issue: await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } }) };
  }

  it("owner only (403 for everyone else, Compliance included); the draft is stored with who shared it and when, and History and audit say so", async () => {
    const { issue, kevin } = await resolvedWithTask();
    for (const name of ["Adrian Koh", "Mei Chen", "Rachel Wong"]) {
      await expect(shareDraft(await user(name), issue.id, { ...DRAFT, version: issue.version }), name).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
    }
    expect((await taskOf(issue.id))!.draftSharedAt).toBeNull();

    await shareDraft(kevin, issue.id, { ...DRAFT, version: issue.version });
    const task = (await taskOf(issue.id))!;
    expect(task).toMatchObject({ draftLink: DRAFT.draftLink, draftSummary: DRAFT.draftSummary, draftSharedById: kevin.id });
    expect(Math.abs(task.draftSharedAt!.getTime() - now().getTime())).toBeLessThan(10_000);
    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report draft shared" } } });
    expect(history.summary).toBe("Root cause report draft shared by Kevin Lim (Ops)");
    expect(history.details).toMatchObject({ kind: "REPORT_DRAFT_SHARED", draftLink: DRAFT.draftLink });
    const audit = await db.auditEntry.findMany({ where: { objectId: issue.id, field: { in: ["Root cause report draft shared", "Draft shared by", "Draft link", "Draft summary"] } } });
    expect(audit).toHaveLength(4);
    // Sharing twice is refused while the draft waits for Compliance.
    await expect(shareDraft(kevin, issue.id, { ...DRAFT, version: issue.version })).rejects.toMatchObject({ fieldErrors: { task: ["The draft is shared and waits for Compliance"] } });
  });

  it("the link is required, https on docs.corvane-internal.example, 2,048 characters at most; the summary 10 to 2,000", () => {
    const ok = { ...DRAFT, version: 1 };
    expect(shareDraftSchema.safeParse(ok).success).toBe(true);
    expect(shareDraftSchema.safeParse({ ...ok, draftLink: "" }).success).toBe(false);
    expect(shareDraftSchema.safeParse({ ...ok, draftLink: "https://evil.example/report.pdf" }).success).toBe(false);
    expect(shareDraftSchema.safeParse({ ...ok, draftLink: "http://docs.corvane-internal.example/a" }).success).toBe(false);
    expect(shareDraftSchema.safeParse({ ...ok, draftLink: `https://docs.corvane-internal.example/${"a".repeat(2040)}` }).success).toBe(false);
    expect(shareDraftSchema.safeParse({ ...ok, draftSummary: "Too short" }).success).toBe(false);
    expect(shareDraftSchema.safeParse({ ...ok, draftSummary: "x".repeat(2001) }).success).toBe(false);
  });

  it("Compliance cannot approve before there is a draft", async () => {
    const { issue } = await resolvedWithTask();
    await expect(approveReport(await user("Mei Chen"), issue.id, {})).rejects.toMatchObject({ fieldErrors: { task: ["The owner has not shared the draft yet"] } });
    expect((await taskOf(issue.id))!.approvedAt).toBeNull();
  });
});

describe("Compliance requests changes, the owner shares a new draft", () => {
  async function resolvedWithDraft() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    await share(fx.issue.id);
    return { ...fx, issue: await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } }) };
  }

  it("any Compliance-team user can (403 for everyone else); the reason is 10 to 2,000 characters; nothing changes on a 403", async () => {
    const { issue } = await resolvedWithDraft();
    for (const name of ["Kevin Lim", "Adrian Koh", "Rachel Wong"]) {
      await expect(requestChanges(await user(name), issue.id, { reason: "The impact section is missing the customer count." }), name).rejects.toMatchObject({ status: 403 });
    }
    expect((await taskOf(issue.id))!.draftSharedAt).not.toBeNull();
    expect(requestChangesSchema.safeParse({ reason: "Too short" }).success).toBe(false);
    expect(requestChangesSchema.safeParse({ reason: "x".repeat(2001) }).success).toBe(false);
    expect(requestChangesSchema.safeParse({ reason: "The impact section is missing the customer count." }).success).toBe(true);
  });

  it("reopens Prepare for the owner and makes Compliance wait again; the refused draft stays in History; a new draft replaces it and clears the request; approval then works", async () => {
    const { issue, kevin } = await resolvedWithDraft();
    const mei = await user("Mei Chen");
    await requestChanges(mei, issue.id, { reason: "The impact section is missing the customer count." });

    const task = (await taskOf(issue.id))!;
    expect(task).toMatchObject({ draftLink: null, draftSummary: null, draftSharedAt: null, draftSharedById: null, changesRequestedById: mei.id, changesRequestReason: "The impact section is missing the customer count." });
    const asked = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Changes requested by" } } });
    expect(asked.summary).toBe("Changes requested by Mei Chen (Compliance): The impact section is missing the customer count.");
    expect(asked.details).toMatchObject({ kind: "REPORT_CHANGES_REQUESTED", draftLink: DRAFT.draftLink, draftSummary: DRAFT.draftSummary }); // the refused draft, kept
    expect(await db.auditEntry.count({ where: { objectId: issue.id, field: "Changes requested by" } })).toBe(1);

    // Home: Kevin prepares again (with the reason on the step); Mei waits on him.
    const kevinHome = await loadWorklistIssues(kevin, "mine");
    expect(kevinHome.main.find((r) => r.issueId === issue.id)!.view.line1).toEqual({ kind: "own", label: "Prepare root cause report for Revolut Ltd" });
    const meiHome = await loadWorklistIssues(mei, "mine");
    expect(rowLines(meiHome.main.find((r) => r.issueId === issue.id)!)).toContainEqual({ kind: expect.any(String), person: "Kevin Lim", label: "Share the draft" });
    // And she cannot approve (or ask again) until there is a new draft.
    await expect(approveReport(mei, issue.id, {})).rejects.toMatchObject({ fieldErrors: { task: ["The owner has not shared the draft yet"] } });
    await expect(requestChanges(mei, issue.id, { reason: "Asking again without a new draft." })).rejects.toMatchObject({ fieldErrors: { task: ["The owner has not shared the draft yet"] } });

    // A new draft replaces the old one; the request is cleared; both drafts are in History.
    await share(issue.id, { draftLink: "https://docs.corvane-internal.example/reports/draft-2.pdf", draftSummary: "Cause, impact (with the customer count) and corrective actions (draft 2)." });
    const again = (await taskOf(issue.id))!;
    expect(again).toMatchObject({ draftLink: "https://docs.corvane-internal.example/reports/draft-2.pdf", changesRequestedAt: null, changesRequestReason: null });
    const drafts = await db.historyEvent.findMany({ where: { issueId: issue.id, summary: { startsWith: "Root cause report draft shared" } }, orderBy: { createdAt: "asc" } });
    expect(drafts.map((d) => (d.details as { draftLink: string }).draftLink)).toEqual([DRAFT.draftLink, "https://docs.corvane-internal.example/reports/draft-2.pdf"]);

    await approveReport(mei, issue.id, { note: "Better." });
    expect((await taskOf(issue.id))!.approvedAt).not.toBeNull();
    // Once approved there is nothing to ask changes on.
    await expect(requestChanges(mei, issue.id, { reason: "Too late to ask for changes." })).rejects.toMatchObject({ fieldErrors: { task: ["The root cause report is already approved"] } });
  });
});

describe("Compliance approves the report", () => {
  async function resolvedWithTask() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    return { ...fx, issue: await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } }) };
  }

  it("any Compliance-team user can approve (the same permission as an assessment); everyone else gets 403 and nothing is written", async () => {
    const { issue } = await resolvedWithTask();
    for (const name of ["Kevin Lim", "Adrian Koh", "Rachel Wong", "Lukas Brenner"]) {
      await expect(approveReport(await user(name), issue.id, {}), name).rejects.toMatchObject({ status: 403 });
    }
    expect((await taskOf(issue.id))!.approvedAt).toBeNull();
    expect(await db.historyEvent.count({ where: { issueId: issue.id, summary: { startsWith: "Root cause report approved" } } })).toBe(0);
  });

  it("the Done line, the History event and the audit entry name the person who actually approved, from the demo clock; a note is optional (2,000 characters)", async () => {
    const { issue } = await resolvedWithTask();
    const mei = await user("Mei Chen");
    await approve(issue.id, mei, "Reads well; the timeline matches the incident log.");
    const task = (await taskOf(issue.id))!;
    expect(task.approvedById).toBe(mei.id);
    expect(task.approvalNote).toBe("Reads well; the timeline matches the incident log.");
    expect(Math.abs(task.approvedAt!.getTime() - now().getTime())).toBeLessThan(10_000);

    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report approved" } } });
    expect(history.category).toBe("INCIDENT");
    expect(history.summary).toBe("Root cause report approved by Mei Chen (Compliance)");
    expect(history.actorName).toBe("Mei Chen");
    const audit = await db.auditEntry.findMany({ where: { objectId: issue.id, field: { in: ["Root cause report approved", "Report approved by", "Approval note"] } } });
    expect(audit.map((a) => a.field).sort()).toEqual(["Approval note", "Report approved by", "Root cause report approved"]);
    expect(audit.find((a) => a.field === "Report approved by")!.newValue).toBe("Mei Chen");
    // Approving does not touch the issue's version: the owner's open page stays valid.
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).version).toBe(issue.version);

    await expect(approve(issue.id)).rejects.toMatchObject({ fieldErrors: { task: ["The root cause report is already approved"] } });
    expect(approveReportSchema.safeParse({ note: "x".repeat(2001) }).success).toBe(false);
    expect(approveReportSchema.safeParse({}).success).toBe(true);
  });

  it("another Compliance user approving is recorded under their own name, not the assigned reviewer's", async () => {
    const { issue } = await resolvedWithTask();
    // The seed has one Compliance person: Rachel Wong (Finance) stands in for a second one, then goes back to her team.
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    await db.user.update({ where: { id: rachel.id }, data: { team: "COMPLIANCE" } });
    try {
      await approve(issue.id, await user("Rachel Wong"));
    } finally {
      await db.user.update({ where: { id: rachel.id }, data: { team: rachel.team } });
    }
    const task = (await taskOf(issue.id))!;
    expect(task.approvedById).toBe(rachel.id);
    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { startsWith: "Root cause report approved" } } });
    expect(history.summary).toBe("Root cause report approved by Rachel Wong (Compliance)");
  });
});

describe("Home and ownership (M27 AC4, AC6, edge case 4)", () => {
  async function resolvedWithTask() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } });
    const contact = await db.contact.findFirstOrThrow({ where: { entityId: fx.entity.id, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
    return { ...fx, issue, contact };
  }

  it("the owner's Home keeps the Resolved issue in the main list with 'Send root cause report', then moves it to the Resolved group once recorded; Compliance reviews under Contributing until then", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    const mei = await user("Mei Chen");

    // Right after the resolution: Kevin prepares the report (his own step, by the contract deadline); Mei waits on him to share the draft.
    const prepareKevin = await loadWorklistIssues(kevin, "mine");
    const prepareRow = prepareKevin.main.find((r) => r.issueId === issue.id)!;
    expect(rowLines(prepareRow).map((l) => l.label)).toContain("Prepare root cause report for Revolut Ltd");
    // Mine shows Kevin's own deadline on the issue (the report, a date), though the communicator's "Confirm resolution" (1 business day) is nearer.
    expect(prepareRow.view.time).toMatchObject({ own: true, label: "Report", dateOnly: true });
    const meiWaiting = await loadWorklistIssues(mei, "mine");
    expect(rowLines(meiWaiting.main.find((r) => r.issueId === issue.id)!)).toContainEqual({ kind: expect.any(String), person: "Kevin Lim", label: "Share the draft" });

    // The draft is shared: Kevin waits on Compliance; Mei has the approval in her Issues list, by the report's deadline.
    await share(issue.id);
    const waitingKevin = await loadWorklistIssues(kevin, "mine");
    expect(rowLines(waitingKevin.main.find((r) => r.issueId === issue.id)!)).toContainEqual({ kind: expect.any(String), person: "Mei Chen", label: "Approve the report" });
    const meiBefore = await loadWorklistIssues(mei, "mine");
    const meiRow = meiBefore.main.find((r) => r.issueId === issue.id)!;
    expect(meiRow).toBeDefined();
    expect(meiRow.view.line1).toEqual({ kind: "own", label: "Approve root cause report" });
    expect(meiRow.view.time).toMatchObject({ label: "Approve report", own: true }); // her own deadline wins over the nearer Confirm of the communicator
    expect(meiBefore.contributing.some((r) => r.issueId === issue.id)).toBe(false);

    await approve(issue.id, mei);
    const before = await loadWorklistIssues(kevin, "mine");
    const row = before.main.find((r) => r.issueId === issue.id)!;
    expect(row).toBeDefined();
    expect(rowLines(row).map((l) => l.label)).toContain("Send approved report to Revolut Ltd");
    expect(row.view.statusNote).toBe("Resolved");
    expect(before.resolvedWaiting.some((r) => r.issueId === issue.id)).toBe(false);

    // Approved: Mei's review is done, so the issue leaves her Issues list (she is a contributor on a Resolved issue: the collapsed group).
    const meiApproved = await loadWorklistIssues(mei, "mine");
    expect(meiApproved.main.some((r) => r.issueId === issue.id)).toBe(false);

    await recordReportSent(kevin, issue.id, {
      sentAt: now().toISOString(), contactId: contact.id, channel: "EMAIL", summary: "Cause, impact and corrective actions.", version: issue.version,
    });
    const after = await loadWorklistIssues(kevin, "mine");
    expect(after.main.some((r) => r.issueId === issue.id)).toBe(false);
    expect(after.resolvedWaiting.some((r) => r.issueId === issue.id)).toBe(true);
    const meiAfter = await loadWorklistIssues(mei, "mine");
    expect(meiAfter.contributing.some((r) => r.issueId === issue.id)).toBe(false);
    expect(meiAfter.resolvedWaiting.some((r) => r.issueId === issue.id)).toBe(true);
  });

  it("a Closed issue with an open report task stays in the owner's main list; once recorded it leaves", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await approve(issue.id);
    await db.issue.update({ where: { id: issue.id }, data: { status: "CLOSED", closedAt: now(), version: { increment: 1 } } });
    const closed = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });

    const open = await loadWorklistIssues(kevin, "mine");
    const row = open.main.find((r) => r.issueId === issue.id)!;
    expect(row.view.line1.kind).toBe("own");
    expect(row.view.statusNote).toBe("Closed");
    // The communicator (Adrian Koh) has nothing to do on a Closed issue: it is not on their Home.
    const adrian = await loadWorklistIssues(await user("Adrian Koh"), "mine");
    expect([...adrian.main, ...adrian.contributing, ...adrian.resolvedWaiting].some((r) => r.issueId === issue.id)).toBe(false);

    await recordReportSent(kevin, issue.id, {
      sentAt: now().toISOString(), contactId: contact.id, channel: "EMAIL", summary: "Cause, impact and corrective actions.", version: closed.version,
    });
    const after = await loadWorklistIssues(kevin, "mine");
    expect([...after.main, ...after.contributing, ...after.resolvedWaiting].some((r) => r.issueId === issue.id)).toBe(false);
  });

  it("the owner reassigned: the task moves with the issue (edge case 4)", async () => {
    const { issue, kevin } = await resolvedWithTask();
    await approve(issue.id);
    const adrian = await user("Adrian Koh");
    // Reassignment is for an open issue: back to work first.
    await db.issue.update({ where: { id: issue.id }, data: { status: "IN_PROGRESS", version: { increment: 1 } } });
    const open = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    await reassignIssue(kevin, issue.id, { newOwnerId: adrian.id, reason: "Adrian takes over the customer follow-up.", version: open.version });
    await db.issue.update({ where: { id: issue.id }, data: { status: "RESOLVED", version: { increment: 1 } } });

    const newOwner = await loadWorklistIssues(adrian, "mine");
    expect(rowLines(newOwner.main.find((r) => r.issueId === issue.id)!).map((l) => l.label)).toContain("Send approved report to Revolut Ltd");
    const oldOwner = await loadWorklistIssues(kevin, "mine");
    expect(oldOwner.main.some((r) => r.issueId === issue.id)).toBe(false);
  });
});

describe("Confirm resolution with the customer, and when the issue closes", () => {
  async function resolvedWithTask() {
    const fx = await createIssue("Revolut Ltd");
    await resolve(fx.issue.id, fx.kevin);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } });
    const contact = await db.contact.findFirstOrThrow({ where: { entityId: fx.entity.id, context: "CUSTOMER", role: "INCIDENT", status: "ACTIVE" } });
    return { ...fx, issue, contact };
  }
  const confirm = async (issueId: string) => {
    const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
    const adrian = await user("Adrian Koh"); // Revolut's owner: the communicator
    return closeIssue(adrian, issueId, { personName: "Priya Nair", channel: "EMAIL", occurredAt: new Date(Math.floor(now().getTime() / 60_000) * 60_000).toISOString(), version: issue.version });
  };
  const send = async (issueId: string, kevin: Awaited<ReturnType<typeof user>>, contactId: string) => {
    await approve(issueId);
    const issue = await db.issue.findUniqueOrThrow({ where: { id: issueId } });
    return recordReportSent(kevin, issueId, { sentAt: now().toISOString(), contactId, channel: "EMAIL", summary: "Cause, impact and corrective actions of the outage.", version: issue.version });
  };

  it("the confirmation with the report steps still open leaves the issue Resolved; sending the report, the last step, closes it", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await confirm(issue.id);
    const afterConfirm = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(afterConfirm.status).toBe("RESOLVED");
    expect(afterConfirm.closedAt).toBeNull();
    expect(await db.issueCommunication.count({ where: { issueId: issue.id, type: "CLOSURE_CONFIRMED" } })).toBe(1);
    const history = await db.historyEvent.findFirstOrThrow({ where: { issueId: issue.id, summary: { contains: "resolution confirmed with the customer by Adrian Koh" } } });
    expect(history.category).toBe("INCIDENT");
    expect(await db.auditEntry.count({ where: { objectId: issue.id, field: "Resolution confirmed with the customer" } })).toBe(1);

    // The report steps can still be completed after the confirmation.
    await send(issue.id, kevin, contact.id);
    const closed = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).not.toBeNull();
    expect(closed.closedById).toBe(kevin.id);
    expect(await db.historyEvent.count({ where: { issueId: issue.id, summary: { endsWith: "closed: every step is done" } } })).toBe(1);
  });

  it("the report sent first, then the confirmation: the confirmation is the last step and closes the issue", async () => {
    const { issue, kevin, contact } = await resolvedWithTask();
    await send(issue.id, kevin, contact.id);
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("RESOLVED"); // not confirmed yet
    await confirm(issue.id);
    expect((await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).status).toBe("CLOSED");
  });

  it("an issue with no report task closes on the confirmation, as before; confirming twice is refused", async () => {
    const fx = await createIssue("Revolut Ltd", { severity: "SEV2" });
    await resolve(fx.issue.id, fx.kevin);
    expect(await db.rootCauseReportTask.count({ where: { issueId: fx.issue.id } })).toBe(0);
    await confirm(fx.issue.id);
    expect((await db.issue.findUniqueOrThrow({ where: { id: fx.issue.id } })).status).toBe("CLOSED");
    await expect(confirm(fx.issue.id)).rejects.toMatchObject({ fieldErrors: { status: ["This issue isn't Resolved yet"] } });
  });

  it("confirming twice while the report is open is refused: the resolution is already confirmed", async () => {
    const { issue } = await resolvedWithTask();
    await confirm(issue.id);
    await expect(confirm(issue.id)).rejects.toMatchObject({ fieldErrors: { status: ["The resolution is already confirmed"] } });
  });
});
