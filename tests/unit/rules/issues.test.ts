import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import { issueDisplayId } from "@/lib/labels";
import { businessMinutesBetween, isInBusinessHours, nextBusinessStart, teamCalendar, userCalendar } from "@/lib/business-hours";
import { tzAbbreviation } from "@/lib/time-zones";
import { proposeSeverity } from "@/server/derived/severity";
import { computeClocks, type IssueClockFields } from "@/server/derived/issue-clocks";
import { onCallAt, routeIssue } from "@/server/issues/routing";
import { ensureSystemWrites } from "@/server/issues/system-writes";
import { buildMessage, gmailComposeUrl } from "@/server/issues/message";
import { chooseComplianceAssessor } from "@/server/issues/compliance-assessor";
import { createLinkedIssues, unlinkIssue } from "@/server/services/issue-partner";
import { recordComplianceAssessment } from "@/server/services/compliance-assessment";
import { loadAffectedCustomers } from "@/server/queries/issue-affected-customers";
import { loadSimilarIssues } from "@/server/queries/issue-similar";
import { loadWorklistIssues } from "@/server/queries/worklist/issues";
import { can } from "@/server/permissions/can";
import {
  acknowledgeIssue,
  addContributor,
  changeIssueStatus,
  changeSeverity,
  changeType,
  reassignIssue,
  removeContributor,
  resolveIssue,
} from "@/server/services/issue";
import { closeIssue, recordCommunication } from "@/server/services/issue-communication";

/**
 * Brief 7.3.1 "rules/issues.test.ts". 6A covered Routing, Business
 * hours, Severity and caps, Clocks. 6B adds Hand-over, Template and
 * Permissions (Fan-out/Compliance assessment/Worklist stay 6C/R2).
 *
 * The Routing section queries the seeded IssueTeamMember/OnCallShift rows,
 * so (like seed.test.ts) it needs the database already reset with
 *   GLEIF_SEED_SOURCE=cache DEMO_CLOCK_START=2026-10-02T09:00:00+03:00 npm run db:reset
 * Business hours, Severity/caps, Clocks and Template are pure functions
 * and need no database. Hand-over and Permissions use throwaway issues
 * (never the real seeded ISS-1031/1038/1042, which seed.test.ts asserts
 * against verbatim) with explicit, fixed `now` instants passed to
 * `ensureSystemWrites()`, so they're deterministic regardless of the
 * real wall-clock time the suite happens to run at.
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });

beforeAll(async () => {
  const count = await db.entity.count();
  if (count === 0) {
    throw new Error("Database is empty. Run `npm run db:reset` before this test (see the file header).");
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Business hours, time zones, DST (brief 4.9.3)", () => {
  // nextBusinessStart() returns a TZDate (zone-attached); its toISOString() prints the zone's own
  // offset (e.g. "+01:00"), not "Z" -- compare absolute instants via getTime() instead.
  it("Emma Wilson (Europe/Amsterdam): 09:00 is 07:00 UTC before 25 Oct, 08:00 UTC after (CEST to CET)", () => {
    const cal = userCalendar({ timeZone: "Europe/Amsterdam", team: "CS" });
    expect(nextBusinessStart(new Date("2026-10-23T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-10-23T07:00:00.000Z").getTime());
    expect(nextBusinessStart(new Date("2026-10-26T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-10-26T08:00:00.000Z").getTime());
  });

  it("Sophie Mitchell (Europe/London): 09:00 is 08:00 UTC before 25 Oct, 09:00 UTC after (BST to GMT)", () => {
    const cal = userCalendar({ timeZone: "Europe/London", team: "CS" });
    expect(nextBusinessStart(new Date("2026-10-23T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-10-23T08:00:00.000Z").getTime());
    expect(nextBusinessStart(new Date("2026-10-26T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-10-26T09:00:00.000Z").getTime());
  });

  it("Michael Reed (America/New_York): 09:00 is 13:00 UTC before 01 Nov, 14:00 UTC after (EDT to EST)", () => {
    const cal = userCalendar({ timeZone: "America/New_York", team: "SALES" });
    expect(nextBusinessStart(new Date("2026-10-30T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-10-30T13:00:00.000Z").getTime());
    expect(nextBusinessStart(new Date("2026-11-02T05:00:00.000Z"), cal).getTime()).toBe(new Date("2026-11-02T14:00:00.000Z").getTime());
  });

  it("a Sev-3 acknowledge clock across the 25 Oct weekend still counts 9 local hours per day", () => {
    const cal = userCalendar({ timeZone: "Europe/Amsterdam", team: "CS" });
    const fri0900 = new Date("2026-10-23T07:00:00.000Z"); // Fri 23 Oct 09:00 CEST
    const mon1800 = new Date("2026-10-26T17:00:00.000Z"); // Mon 26 Oct 18:00 CET
    expect(businessMinutesBetween(fri0900, mon1800, cal)).toBe(2 * 9 * 60); // Friday + Monday, weekend excluded
  });

  it("09:00:00 is inside business hours, 18:00:00 is outside (M18 edge case 1)", () => {
    const cal = teamCalendar("OPS");
    expect(isInBusinessHours(new Date("2026-10-05T01:00:00.000Z"), cal)).toBe(true); // 09:00:00 MYT
    expect(isInBusinessHours(new Date("2026-10-05T10:00:00.000Z"), cal)).toBe(false); // 18:00:00 MYT
  });

  it("abbreviations: CEST/CET, BST/GMT, EDT/EST, MYT, SGT, and the UTC+03:00 fallback", () => {
    expect(tzAbbreviation(new Date("2026-07-01T00:00:00Z"), "Europe/Amsterdam")).toBe("CEST");
    expect(tzAbbreviation(new Date("2026-12-01T00:00:00Z"), "Europe/Amsterdam")).toBe("CET");
    expect(tzAbbreviation(new Date("2026-07-01T00:00:00Z"), "Europe/London")).toBe("BST");
    expect(tzAbbreviation(new Date("2026-12-01T00:00:00Z"), "Europe/London")).toBe("GMT");
    expect(tzAbbreviation(new Date("2026-07-01T00:00:00Z"), "America/New_York")).toBe("EDT");
    expect(tzAbbreviation(new Date("2026-12-01T00:00:00Z"), "America/New_York")).toBe("EST");
    expect(tzAbbreviation(new Date("2026-10-05T00:00:00Z"), "Asia/Kuala_Lumpur")).toBe("MYT");
    expect(tzAbbreviation(new Date("2026-10-05T00:00:00Z"), "Asia/Singapore")).toBe("SGT");
    expect(tzAbbreviation(new Date("2026-10-05T00:00:00Z"), "Europe/Bucharest")).toBe("UTC+03:00");
  });
});

describe("Severity proposal and caps (brief 4.9.4)", () => {
  const base = { possibleBreach: false, decidingStage: "BAU" as const, customerRole: true };

  it("the impact map: Down, Degraded, Isolated case, Question or request", () => {
    expect(proposeSeverity({ ...base, impact: "DOWN", type: "OTHER" }).severity).toBe("SEV1");
    expect(proposeSeverity({ ...base, impact: "DEGRADED", type: "OTHER" }).severity).toBe("SEV2");
    expect(proposeSeverity({ ...base, impact: "ISOLATED_CASE", type: "OTHER" }).severity).toBe("SEV3");
    expect(proposeSeverity({ ...base, impact: "QUESTION_OR_REQUEST", type: "OTHER" }).severity).toBe("SEV4");
  });

  it("Billing 'Down' is capped to Sev-2 (M19 AC9)", () => {
    const p = proposeSeverity({ ...base, impact: "DOWN", type: "BILLING" });
    expect(p.severity).toBe("SEV2");
    expect(p.capLabel).toBe("Highest severity for this type: Sev-2");
  });

  it("possible breach always proposes Sev-1 and overrides the type cap and the pre-go-live cap (B25)", () => {
    const p = proposeSeverity({ impact: "QUESTION_OR_REQUEST", possibleBreach: true, type: "BILLING", decidingStage: "UAT", customerRole: true });
    expect(p.severity).toBe("SEV1");
    expect(p.capLabel).toBeNull();
  });

  it("Revolut Ltd, EU VoP / DE at UAT, Down -> Sev-3 with the before-go-live label (AC2)", () => {
    const p = proposeSeverity({ impact: "DOWN", possibleBreach: false, type: "SERVICE_UNAVAILABLE", decidingStage: "UAT", customerRole: true, scheme: "EU_VOP", country: "DE" });
    expect(p.severity).toBe("SEV3");
    expect(p.capLabel).toBe("Sev-3 maximum before go-live: EU VoP / DE is at UAT");
  });

  it("no live product on the chosen scheme -> the 'no live product on' label (AC3)", () => {
    const p = proposeSeverity({ impact: "DOWN", possibleBreach: false, type: "SERVICE_UNAVAILABLE", decidingStage: null, customerRole: true, scheme: "EU_VOP", country: "DE" });
    expect(p.severity).toBe("SEV3");
    expect(p.capLabel).toBe("Sev-3 maximum before go-live: no live product on EU VoP / DE");
  });

  it("Revolut Ltd, UK CoP / GB, Live & hypercare -> no cap", () => {
    const p = proposeSeverity({ impact: "DOWN", possibleBreach: false, type: "WRONG_MATCH", decidingStage: "LIVE_HYPERCARE", customerRole: true, scheme: "UK_COP", country: "GB" });
    expect(p.severity).toBe("SEV1");
    expect(p.capLabel).toBeNull();
  });

  it("a partner-only entity is never capped before go-live (M17 edge case 1)", () => {
    const p = proposeSeverity({ impact: "QUESTION_OR_REQUEST", possibleBreach: false, type: "OTHER", decidingStage: "UAT", customerRole: false });
    expect(p.severity).toBe("SEV4");
    expect(p.capLabel).toBeNull();
  });
});

describe("Clocks (brief 4.9.5) -- the seeded issues' expected clock texts (7.1.17.5)", () => {
  const viewerZone = "Europe/Amsterdam";

  it("ISS-1042 (mps, Sev-1): acknowledge, notify and compliance clocks all stopped on time", () => {
    const awareAt = new Date("2026-10-04T19:12:00.000Z"); // 21:12 CEST
    const issue: IssueClockFields = {
      severity: "SEV1", status: "IN_PROGRESS", severityCapLabel: null,
      clocksStartAt: awareAt, ackStartAt: awareAt, acknowledgedAt: new Date("2026-10-04T19:21:00.000Z"),
      notifyRequired: true, notifyStartAt: awareAt, notifyTargetHours: 6, notifyDefaultTarget: false, notifyTargetBusinessMins: null,
      notifiedAt: new Date("2026-10-04T20:05:00.000Z"),
      complianceFlaggedAt: awareAt, complianceClockStartAt: awareAt, firstAssessmentAt: new Date("2026-10-04T19:58:00.000Z"),
    };
    const ctx = { ownerCalendar: teamCalendar("OPS"), communicatorCalendar: teamCalendar("OPS"), viewerZone };
    const now = new Date("2026-10-05T12:00:00.000Z");
    const clocks = computeClocks(issue, ctx, now);
    expect(clocks.acknowledge.text).toBe("Acknowledged 9 min after Corvane became aware (target 15 min)");
    expect(clocks.notify.text).toBe("Notified 53 min after Corvane became aware (target 6 h)");
    expect(clocks.compliance!.text).toBe("Assessed 46 min after the flag (target 1 h)");
  });

  it("ISS-1038 (revolut, Sev-2): acknowledge and notify clocks stopped on time", () => {
    const awareAt = new Date("2026-09-29T07:10:00.000Z"); // 15:10 MYT
    const issue: IssueClockFields = {
      severity: "SEV2", status: "IN_PROGRESS", severityCapLabel: null,
      clocksStartAt: new Date("2026-09-29T07:20:00.000Z"), ackStartAt: new Date("2026-09-29T07:20:00.000Z"), acknowledgedAt: new Date("2026-09-29T07:35:00.000Z"),
      notifyRequired: true, notifyStartAt: awareAt, notifyTargetHours: null, notifyDefaultTarget: false, notifyTargetBusinessMins: 240,
      notifiedAt: new Date("2026-09-29T08:10:00.000Z"),
      complianceFlaggedAt: null, complianceClockStartAt: null, firstAssessmentAt: null,
    };
    const ctx = { ownerCalendar: teamCalendar("OPS"), communicatorCalendar: teamCalendar("OPS"), viewerZone: "Asia/Kuala_Lumpur" };
    const now = new Date("2026-10-05T12:00:00.000Z");
    const clocks = computeClocks(issue, ctx, now);
    expect(clocks.acknowledge.text).toBe("Acknowledged 15 min after Corvane became aware (target 1 h)");
    expect(clocks.notify.text).toBe("Notified 1 h after Corvane became aware (target 4 business hours)");
    expect(clocks.compliance).toBeNull();
  });

  it("ISS-1031 (hvb, Sev-3): acknowledge stopped on time; no notification deadline at Sev-3", () => {
    const savedAt = new Date("2026-10-02T03:00:00.000Z"); // Fri 02 Oct 11:00 SGT
    const issue: IssueClockFields = {
      severity: "SEV3", status: "IN_PROGRESS", severityCapLabel: null,
      clocksStartAt: savedAt, ackStartAt: savedAt, acknowledgedAt: new Date("2026-10-02T03:30:00.000Z"),
      notifyRequired: false, notifyStartAt: null, notifyTargetHours: null, notifyDefaultTarget: false, notifyTargetBusinessMins: null,
      notifiedAt: null,
      complianceFlaggedAt: null, complianceClockStartAt: null, firstAssessmentAt: null,
    };
    const ctx = { ownerCalendar: teamCalendar("FINANCE"), communicatorCalendar: teamCalendar("FINANCE"), viewerZone: "Asia/Singapore" };
    const now = new Date("2026-10-05T12:00:00.000Z");
    const clocks = computeClocks(issue, ctx, now);
    expect(clocks.acknowledge.text).toBe("Acknowledged 30 min after Corvane became aware (target 1 business day)");
    expect(clocks.notify.text).toBe("Customer notification: no deadline at Sev-3");
  });

  it("clockText boundaries: 'in N min', 'now', 'Overdue by', never 'in 0 min'", () => {
    const issue: IssueClockFields = {
      severity: "SEV1", status: "NEW", severityCapLabel: null,
      clocksStartAt: new Date("2026-10-05T10:00:00.000Z"), ackStartAt: new Date("2026-10-05T10:00:00.000Z"), acknowledgedAt: null,
      notifyRequired: false, notifyStartAt: null, notifyTargetHours: null, notifyDefaultTarget: false, notifyTargetBusinessMins: null, notifiedAt: null,
      complianceFlaggedAt: null, complianceClockStartAt: null, firstAssessmentAt: null,
    };
    const ctx = { ownerCalendar: teamCalendar("OPS"), communicatorCalendar: teamCalendar("OPS"), viewerZone: "Europe/Amsterdam" };
    // Target 15 min; "now" is 9 minutes after clocksStartAt -> due in 6 min.
    const dueIn6 = computeClocks(issue, ctx, new Date("2026-10-05T10:09:00.000Z"));
    expect(dueIn6.acknowledge.text).toBe("Acknowledge in 6 min");
    // Exactly at the due time.
    const dueNow = computeClocks(issue, ctx, new Date("2026-10-05T10:15:00.000Z"));
    expect(dueNow.acknowledge.text).toBe("Acknowledge now");
    // 2 minutes late.
    const overdue = computeClocks(issue, ctx, new Date("2026-10-05T10:17:00.000Z"));
    expect(overdue.acknowledge.text).toBe("Overdue by 2 min");
    expect(overdue.acknowledge.overdue).toBe(true);
  });
});

describe("Routing (brief 4.9.2, M18) -- against the seeded issue team and on-call rota", () => {
  async function entity(legalName: string) {
    return db.entity.findFirstOrThrow({
      where: { legalName },
      include: { owner: { select: { id: true, timeZone: true, team: true } } },
    });
  }

  it("owner team by type: the 8 types route to the 6 owner teams (3.3.6 ISSUE_TYPE_ROUTING)", async () => {
    const revolut = await entity("Revolut Ltd");
    const cases: { type: Parameters<typeof routeIssue>[1]["type"]; team: string }[] = [
      { type: "SERVICE_UNAVAILABLE", team: "OPS" },
      { type: "PARTNER_DEGRADED", team: "NETWORK" },
      { type: "WRONG_MATCH", team: "OPS" },
      { type: "INTEGRATION_BLOCKER", team: "OPS" },
      { type: "BILLING", team: "FINANCE" },
      { type: "DATA_BREACH_SECURITY", team: "COMPLIANCE" },
      { type: "COMMERCIAL_COVERAGE", team: "SALES" },
      { type: "OTHER", team: "OPS" },
    ];
    // Monday 09:00 CEST = 14:00 MYT: inside Ops hours, inside Network/Compliance/Finance hours (SGT), inside Sales hours (Michael Reed, America/New_York, is asleep -- Commercial/coverage is queued, not routed to a person, but the owner TEAM is still set synchronously).
    const t = new Date("2026-10-05T07:00:00.000Z");
    for (const c of cases) {
      const routing = await routeIssue(db, { type: c.type, severity: "SEV4", entity: revolut }, t);
      expect(routing.ownerTeam).toBe(c.team);
    }
  });

  it("named person in hours: Emma Wilson on Revolut Ltd, Monday 08:00 CEST = 14:00 MYT -> Kevin Lim (AC3)", async () => {
    const revolut = await entity("Revolut Ltd");
    const t = new Date("2026-10-05T06:00:00.000Z"); // 08:00 CEST = 14:00 MYT
    const routing = await routeIssue(db, { type: "WRONG_MATCH", severity: "SEV2", entity: revolut }, t);
    expect(routing.rule).toBe("NAMED_PERSON");
    const named = await db.issueTeamMember.findUnique({ where: { entityId_team: { entityId: revolut.id, team: "OPS" } }, include: { user: true } });
    expect(routing.ownerId).toBe(named!.userId);
    expect(named!.user.name).toBe("Kevin Lim");
  });

  it("no named person in hours -> on-call, 'No named Ops person on this entity: routed to on-call' (AC4)", async () => {
    // Every seeded entity has all five IssueTeamMember rows (7.1.17.3), so this rule is exercised
    // against an entity with none at all, rather than a seeded one -- onCallAt() looks up the team's
    // rota directly and doesn't care whether the entity itself exists.
    const noTeamEntity = { id: "no-such-entity", legalName: "Test Entity", ownerId: null, owner: null };
    const t = new Date("2026-10-05T07:00:00.000Z"); // Monday 09:00 CEST = 14:00 MYT, inside Ops hours
    const routing = await routeIssue(db, { type: "SERVICE_UNAVAILABLE", severity: "SEV4", entity: noTeamEntity }, t);
    expect(routing.rule).toBe("ON_CALL_IN_HOURS");
    expect(routing.routingReason).toBe("No named Ops person on this entity: routed to on-call");
    const onCall = await onCallAt(db, "OPS", t);
    expect(routing.ownerId).toBe(onCall!.id);
  });

  it("Sev-1 out of hours -> the owner team's on-call person (ISS-1042 pattern, 03:12 MYT)", async () => {
    const mps = await entity("Banca Monte dei Paschi di Siena S.p.A.");
    const t = new Date("2026-10-04T19:12:00.000Z"); // 21:12 CEST = 03:12 MYT, outside Ops hours
    const routing = await routeIssue(db, { type: "SERVICE_UNAVAILABLE", severity: "SEV1", entity: mps }, t);
    expect(routing.rule).toBe("ON_CALL_OUT_OF_HOURS");
    const onCall = await onCallAt(db, "OPS", t);
    expect(routing.ownerId).toBe(onCall!.id);
    expect(onCall!.name).toBe("Kevin Lim");
  });

  it("Sev-1 out of hours: the owner communicates until the customer owner's hours start (rule 3)", async () => {
    const mps = await entity("Banca Monte dei Paschi di Siena S.p.A.");
    const t = new Date("2026-10-04T19:12:00.000Z");
    const routing = await routeIssue(db, { type: "SERVICE_UNAVAILABLE", severity: "SEV1", entity: mps }, t);
    expect(routing.communicatorRule).toBe("ISSUE_OWNER_UNTIL_HANDOVER");
    expect(routing.handoverAt).not.toBeNull();
    expect(routing.handoverAt!.getTime()).toBeGreaterThan(t.getTime());
  });

  it("Sales owner team uses the named Sales person's own time zone (Michael Reed, America/New_York)", async () => {
    const revolut = await entity("Revolut Ltd");
    // 09:30 New York time on a Monday -- inside Michael Reed's own hours even though it is the
    // middle of the night in every other team's zone.
    const t = new Date("2026-10-05T13:30:00.000Z");
    const routing = await routeIssue(db, { type: "COMMERCIAL_COVERAGE", severity: "SEV4", entity: revolut }, t);
    expect(routing.rule).toBe("NAMED_PERSON");
    const named = await db.issueTeamMember.findUnique({ where: { entityId_team: { entityId: revolut.id, team: "SALES" } }, include: { user: true } });
    expect(named!.user.name).toBe("Michael Reed");
    expect(routing.ownerId).toBe(named!.userId);
  });

  it("default contributor: Wrong match result on Revolut Ltd adds Lukas Brenner (Network), never from on-call", async () => {
    const revolut = await entity("Revolut Ltd");
    const t = new Date("2026-10-05T07:00:00.000Z");
    const routing = await routeIssue(db, { type: "WRONG_MATCH", severity: "SEV2", entity: revolut }, t);
    expect(routing.ownerTeam).toBe("OPS");
    const named = await db.issueTeamMember.findUnique({ where: { entityId_team: { entityId: revolut.id, team: "NETWORK" } }, include: { user: true } });
    expect(named!.user.name).toBe("Lukas Brenner");
  });

  it("no on-call shift covering the instant -> no owner can be found", async () => {
    const mps = await entity("Banca Monte dei Paschi di Siena S.p.A.");
    const farFuture = new Date("2030-01-01T00:00:00.000Z"); // outside every seeded OnCallShift window
    await expect(routeIssue(db, { type: "SERVICE_UNAVAILABLE", severity: "SEV1", entity: mps }, farFuture)).rejects.toThrow();
  });
});

describe("Severity and type change services (brief M19 AC13-AC20)", () => {
  // Each test works on a fresh throwaway issue, created directly (not through createIssue()/
  // routeIssue(), whose outcome depends on the real current time of day) rather than mutating
  // ISS-1031/1038/1042, which seed.test.ts asserts against verbatim. Deleted afterward.
  // A plain db.issue.create() with no `number` falls back to the schema's
  // nextval('issue_number_seq') default -- which permanently advances the
  // real sequence (a delete doesn't roll it back), bleeding into
  // seed.test.ts's "next issue number is 1043" assertion whenever both
  // files run in the same vitest process. Each throwaway issue sets its
  // own obviously-fake number instead, well outside the real range, so it
  // never touches the sequence.
  let throwawayNumber = 9_000_000;
  async function createThrowawayIssue() {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const awareAt = new Date("2026-10-05T07:00:00.000Z"); // Monday 15:00 MYT
    return db.issue.create({
      data: {
        number: throwawayNumber++,
        entityId: revolut.id, type: "WRONG_MATCH", impact: "DEGRADED", possibleBreach: false,
        proposedSeverity: "SEV2", severity: "SEV2",
        description: "Throwaway issue created by issues.test.ts for the change-severity/change-type services.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS",
        customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
        ownerTeam: "OPS", ownerId: kevin.id, ownerSince: awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "CUSTOMER_OWNER", clocksStartAt: awareAt, ackStartAt: awareAt,
        ackDueAt: new Date(awareAt.getTime() + 60 * 60_000),
        notifyRequired: true, notifyStartAt: awareAt, notifyTargetBusinessMins: 240, notifyDueAt: new Date(awareAt.getTime() + 300 * 60_000),
      },
    });
  }

  // changeSeverity()/changeType() can add History events and (on a type
  // change) a default contributor -- neither has onDelete: Cascade to
  // Issue, so a plain db.issue.delete() violates their foreign keys.
  // Delete the children first, in dependency order. AuditEntry is NOT
  // among them: objectId is a plain string, not a real foreign key to
  // Issue, and the table is append-only (a DB trigger blocks DELETE for
  // every role, admin included) -- the throwaway issue's audit rows are
  // simply left behind, same as every other write this seed/test suite
  // makes against a database that gets truncated wholesale between runs.
  async function deleteThrowawayIssue(issueId: string) {
    await db.issueContributor.deleteMany({ where: { issueId } });
    await db.issueResolution.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.issueCommunication.deleteMany({ where: { issueId } });
    await db.complianceAssessment.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }

  it("AC14: raising severity recalculates the notification and (unack'd) acknowledge targets from their original starts", async () => {
    const issue = await createThrowawayIssue();
    try {
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      const raised = await changeSeverity(owner, issue.id, { severity: "SEV1", reason: "Second scheme now affected", version: issue.version });
      expect(raised.severity).toBe("SEV1");
      expect(raised.notifyTargetBusinessMins).toBeNull();
      expect(raised.notifyTargetHours).toBe(2); // Revolut's Customer agreement card incidentNoticeHours
      expect(raised.notifyDueAt!.getTime()).toBe(issue.awareAt.getTime() + 2 * 3_600_000);
      expect(raised.ackDueAt!.getTime()).toBe(issue.clocksStartAt.getTime() + 15 * 60_000); // Sev-1 ack target, plain 15 min
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("AC14 edge case 1: already notified -> the notification clock stays stopped, flagged severityRaisedAfterNotice", async () => {
    const issue = await createThrowawayIssue();
    try {
      await db.issue.update({ where: { id: issue.id }, data: { notifiedAt: new Date(issue.awareAt.getTime() + 30 * 60_000) } });
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      const raised = await changeSeverity(owner, issue.id, { severity: "SEV1", reason: "Second scheme now affected", version: issue.version });
      expect(raised.severity).toBe("SEV1");
      expect(raised.severityRaisedAfterNotice).toBe(true);
      expect(raised.notifyTargetBusinessMins).toBe(issue.notifyTargetBusinessMins); // unchanged: stays stopped with its recorded result
      expect(raised.notifyDueAt!.getTime()).toBe(issue.notifyDueAt!.getTime());
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("AC15: lowering severity keeps every clock's target and due time", async () => {
    const issue = await createThrowawayIssue();
    try {
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      const lowered = await changeSeverity(owner, issue.id, { severity: "SEV4", reason: "Isolated to one payee, not a scheme-wide issue", version: issue.version });
      expect(lowered.severity).toBe("SEV4");
      expect(lowered.notifyTargetBusinessMins).toBe(issue.notifyTargetBusinessMins);
      expect(lowered.notifyDueAt!.getTime()).toBe(issue.notifyDueAt!.getTime());
      expect(lowered.ackDueAt!.getTime()).toBe(issue.ackDueAt!.getTime());
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("AC19: a direct call from a non-owner is rejected and changes nothing", async () => {
    const issue = await createThrowawayIssue();
    try {
      const someoneElse = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } }); // Finance, not this issue's Ops owner
      await expect(changeSeverity(someoneElse, issue.id, { severity: "SEV1", reason: "Not actually the owner", version: issue.version })).rejects.toThrow();
      const unchanged = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(unchanged.severity).toBe(issue.severity);
      expect(unchanged.version).toBe(issue.version);
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("AC17-AC18: changing type to Billing caps a Sev-1 (no breach) down to Sev-2, re-routes to Finance, and restarts the acknowledge clock", async () => {
    const issue = await createThrowawayIssue();
    try {
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      const afterRaise = await changeSeverity(owner, issue.id, { severity: "SEV1", reason: "Escalating for now", version: issue.version });
      const changed = await changeType(owner, issue.id, { type: "BILLING", reason: "This is actually a billing dispute, not a match issue", version: afterRaise.version });
      expect(changed.severity).toBe("SEV2");
      expect(changed.severityCapLabel).toBe("Highest severity for this type: Sev-2");
      expect(changed.ownerTeam).toBe("FINANCE");
      expect(changed.status).toBe("NEW");
      expect(changed.acknowledgedAt).toBeNull();
      // The owner re-resolves by Finance's current business hours (named person in hours, queued otherwise) -- both are valid routing outcomes here.
      // Either way `ownerId` is Rachel Wong's: rule 4 (QUEUED_FOR_BUSINESS_HOURS) only leaves `ownerId`
      // null when there's no named person at all (routing.ts: "null: filled in at clock start"); Revolut
      // always has one, so this assertion is time-of-day-independent.
      expect(["NAMED_PERSON", "QUEUED_FOR_BUSINESS_HOURS"]).toContain(changed.routingRule);
      const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
      expect(changed.ownerId).toBe(rachel.id);
      // Default contributor of the new type (Billing -> Sales) was added.
      const contributors = await db.issueContributor.findMany({ where: { issueId: issue.id }, include: { user: true } });
      expect(contributors.map((c) => c.user.name)).toContain("Michael Reed"); // Revolut's named Sales person
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("a default contributor taken off by hand is not added again by a later type change", async () => {
    const issue = await createThrowawayIssue();
    try {
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      const toBilling = await changeType(owner, issue.id, { type: "BILLING", reason: "This is actually a billing dispute", version: issue.version });
      const michael = await db.user.findFirstOrThrow({ where: { name: "Michael Reed" } });
      expect(await db.issueContributor.count({ where: { issueId: issue.id, userId: michael.id, removedAt: null } })).toBe(1);
      const ownerNow = async () => db.user.findUniqueOrThrow({ where: { id: (await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).ownerId! } });
      const removed = await removeContributor(await ownerNow(), issue.id, michael.id, { version: toBilling.version });
      const versionNow = async () => (await db.issue.findUniqueOrThrow({ where: { id: issue.id } })).version;
      expect(removed).toBeDefined();
      await changeType(await ownerNow(), issue.id, { type: "OTHER", reason: "Not a billing dispute after all", version: await versionNow() });
      await changeType(await ownerNow(), issue.id, { type: "BILLING", reason: "Billing again, the customer insists", version: await versionNow() });
      expect(await db.issueContributor.count({ where: { issueId: issue.id, userId: michael.id, removedAt: null } })).toBe(0);
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });

  it("AC20: each change writes an audit entry and a History event", async () => {
    const issue = await createThrowawayIssue();
    try {
      const owner = await db.user.findUniqueOrThrow({ where: { id: issue.ownerId! } });
      await changeSeverity(owner, issue.id, { severity: "SEV1", reason: "Second scheme now affected", version: issue.version });
      const audit = await db.auditEntry.findFirst({ where: { objectType: "ISSUE", objectId: issue.id, field: "Severity" } });
      expect(audit?.oldValue).toBe("Sev-2");
      expect(audit?.newValue).toBe("Sev-1");
      expect(audit?.reason).toBe("Second scheme now affected");
      const history = await db.historyEvent.findFirst({ where: { entityId: issue.entityId, category: "INCIDENT", summary: { contains: "severity changed from Sev-2 to Sev-1" } } });
      expect(history).not.toBeNull();
    } finally {
      await deleteThrowawayIssue(issue.id);
    }
  });
});

describe("Hand-over (brief 4.9.7, M22 AC10) -- ensureSystemWrites() idempotency", () => {
  let handoverNumber = 9_100_000;

  /** Revolut Ltd's current customer owner differs from the throwaway issue's own owner (both Ops, different people) -- exactly the rule 3/3b shape that produces ISSUE_OWNER_UNTIL_HANDOVER. */
  async function createHandoverIssue(handoverAt: Date) {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" }, include: { owner: true } });
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } }); // the on-call issue owner, not Revolut's customer owner
    const awareAt = new Date(handoverAt.getTime() - 3 * 3_600_000);
    return db.issue.create({
      data: {
        number: handoverNumber++,
        entityId: revolut.id, type: "SERVICE_UNAVAILABLE", impact: "DOWN", possibleBreach: false,
        proposedSeverity: "SEV1", severity: "SEV1",
        description: "Throwaway hand-over fixture created by issues.test.ts.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS",
        customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
        ownerTeam: "OPS", ownerId: kevin.id, ownerSince: awareAt, routingRule: "ON_CALL_OUT_OF_HOURS", routingReason: "test fixture",
        communicatorRule: "ISSUE_OWNER_UNTIL_HANDOVER", handoverAt,
        clocksStartAt: awareAt, ackStartAt: awareAt, acknowledgedAt: awareAt,
        notifyRequired: true, notifyStartAt: awareAt, notifyTargetHours: 2, notifyDueAt: new Date(awareAt.getTime() + 2 * 3_600_000),
      },
    });
  }

  async function deleteHandoverIssue(issueId: string) {
    await db.issueCommunication.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }

  it("two reads after handoverAt write exactly one hand-over entry (idempotent)", async () => {
    const handoverAt = new Date("2026-10-05T07:00:00.000Z"); // 09:00 CEST, matching the demo day's own handoverAt
    const issue = await createHandoverIssue(handoverAt);
    const readInstant = new Date(handoverAt.getTime() + 12 * 3_600_000); // well after the hand-over
    try {
      await ensureSystemWrites(issue.id, readInstant);
      await ensureSystemWrites(issue.id, readInstant); // second read: must be a no-op, not a second write

      const comms = await db.issueCommunication.findMany({ where: { issueId: issue.id, systemKey: `handover:${issue.id}` } });
      expect(comms).toHaveLength(1);
      expect(comms[0].type).toBe("SYSTEM");
      expect(comms[0].recordedByName).toBe("Customer Hub");

      const notes = await db.issueNote.findMany({ where: { issueId: issue.id, kind: "SYSTEM" } });
      expect(notes).toHaveLength(1);
      expect(notes[0].body).toContain("Communication handed over to Adrian Koh");

      const audits = await db.auditEntry.findMany({ where: { objectType: "ISSUE", objectId: issue.id, field: "Communicator", source: "SYSTEM_ISSUE" } });
      expect(audits).toHaveLength(1);
      expect(audits[0].newValue).toBe("Adrian Koh");

      const history = await db.historyEvent.findMany({ where: { issueId: issue.id, summary: { contains: "communication handed over" } } });
      expect(history).toHaveLength(1);

      const updated = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(updated.handoverWrittenAt).not.toBeNull();
    } finally {
      await deleteHandoverIssue(issue.id);
    }
  });

  it("before handoverAt: no write, communicatorRule stays interim", async () => {
    const handoverAt = new Date("2026-10-05T07:00:00.000Z");
    const issue = await createHandoverIssue(handoverAt);
    try {
      await ensureSystemWrites(issue.id, new Date(handoverAt.getTime() - 60_000)); // 1 minute before
      const comms = await db.issueCommunication.count({ where: { issueId: issue.id, systemKey: `handover:${issue.id}` } });
      expect(comms).toBe(0);
      const updated = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(updated.handoverWrittenAt).toBeNull();
    } finally {
      await deleteHandoverIssue(issue.id);
    }
  });

  it("after hand-over, the former on-call owner gets 403 communication_handed_over on recordCommunication and close", async () => {
    // Anchored to the real test-run clock (now()), not a hardcoded
    // calendar date: recordCommunication() validates occurredAt against
    // now() ("the time can't be in the future"), so a fixed date only
    // outside the future whenever DEMO_CLOCK_START happens to be on or
    // after it -- it was previously "2026-10-05", which is in the future
    // relative to the DEMO_CLOCK_START=2026-10-02T09:00:00+03:00 that
    // seed.test.ts (and npm run test:all) actually run under, failing
    // this test's own recordCommunication() call before it ever reached
    // the communicator check this test exists to exercise.
    const handoverAt = new Date(now().getTime() - 2 * 3_600_000); // 2 hours ago
    const issue = await createHandoverIssue(handoverAt);
    const afterHandover = new Date(handoverAt.getTime() + 60_000);
    try {
      await ensureSystemWrites(issue.id, afterHandover);
      const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
      await expect(
        recordCommunication(kevin, issue.id, { type: "UPDATE", occurredAt: afterHandover.toISOString(), channel: "EMAIL", personName: "Test contact", message: "This should be rejected: handed over already", version: issue.version }),
      ).rejects.toMatchObject({ code: "communication_handed_over", status: 403 });
    } finally {
      await deleteHandoverIssue(issue.id);
    }
  });
});

describe("Message template (brief 4.9.10, M22 AC3-AC5)", () => {
  const issue = {
    number: 1042,
    type: "SERVICE_UNAVAILABLE" as const,
    scheme: "EU_VOP" as const,
    country: "IT",
    impact: "DOWN" as const,
    status: "IN_PROGRESS" as const,
    severity: "SEV1" as const,
    awareAt: new Date("2026-10-04T19:12:00.000Z"), // 21:12 CEST
  };
  const entity = { legalName: "Banca Monte dei Paschi di Siena S.p.A.", country: "IT" };
  const contact = { name: "Silvia Moretti", email: "silvia.moretti@mps.example", timeZone: "Europe/Rome" };
  const preparedAt = new Date("2026-10-04T20:00:00.000Z"); // 22:00 CEST

  it("subject: '[Corvane] Sev-1 incident ISS-1042: EU VoP IT'", () => {
    const msg = buildMessage(issue, entity, contact, "Kevin Lim", preparedAt);
    expect(msg.subject).toBe("[Corvane] Sev-1 incident ISS-1042: EU VoP IT");
  });

  it("subject ends after the ID with no scheme and country", () => {
    const msg = buildMessage({ ...issue, scheme: null, country: null }, entity, contact, "Kevin Lim", preparedAt);
    expect(msg.subject).toBe("[Corvane] Sev-1 incident ISS-1042");
  });

  it("body, exact line order for ISS-1042 prepared by Kevin Lim at 22:00 CEST (M22 AC3)", () => {
    const msg = buildMessage(issue, entity, contact, "Kevin Lim", preparedAt);
    expect(msg.body).toBe(
      [
        "Dear Silvia Moretti,",
        "",
        "We are informing you of an incident affecting Banca Monte dei Paschi di Siena S.p.A.",
        "",
        "Affected service: EU VoP, IT",
        "Corvane aware at: Sun 04 Oct, 21:12 CEST",
        "Impact: Down",
        "Current status: Investigating",
        "Next update by: Mon 05 Oct, 00:00 CEST",
        "Issue ID: ISS-1042",
        "",
        "Please quote ISS-1042 in any reply.",
        "",
        "Kind regards,",
        "Kevin Lim",
        "Corvane",
      ].join("\n"),
    );
    expect(msg.to).toBe("silvia.moretti@mps.example");
  });

  it("no active incident contact: generic greeting, no recipient (M22 edge case 1)", () => {
    const msg = buildMessage(issue, entity, null, "Kevin Lim", preparedAt);
    expect(msg.body.startsWith("Dear Banca Monte dei Paschi di Siena S.p.A. team,")).toBe(true);
    expect(msg.to).toBeNull();
  });

  it("Sev-3 and Sev-4: 'Next update: when the status changes', not a computed time", () => {
    const sev3 = buildMessage({ ...issue, severity: "SEV3" }, entity, contact, "Kevin Lim", preparedAt);
    expect(sev3.body).toContain("Next update: when the status changes");
    const sev4 = buildMessage({ ...issue, severity: "SEV4" }, entity, contact, "Kevin Lim", preparedAt);
    expect(sev4.body).toContain("Next update: when the status changes");
  });

  it("gmailComposeUrl() URL-encodes the recipient, subject and body", () => {
    const url = gmailComposeUrl("silvia.moretti@mps.example", "[Corvane] Sev-1 incident ISS-1042: EU VoP IT", "Dear Silvia,\n\nLine two.");
    expect(url).toContain("to=silvia.moretti%40mps.example");
    expect(url).toContain("su=%5BCorvane%5D%20Sev-1%20incident%20ISS-1042%3A%20EU%20VoP%20IT");
    expect(url).toContain("body=Dear%20Silvia%2C%0A%0ALine%20two.");
  });
});

describe("Permissions (brief 4.9.12) -- 403 codes and the matrix", () => {
  it("can() grants issue.communicator E to all 6 teams (matrix row 33)", () => {
    for (const team of ["SALES", "OPS", "CS", "NETWORK", "COMPLIANCE", "FINANCE"] as const) {
      const user = { id: "u", name: "Test", team, isAdmin: false, active: true };
      expect(can(user, "issue.communicator").ok).toBe(true);
    }
  });

  let permNumber = 9_200_000;
  async function createPermIssue() {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } }); // Ops, this issue's owner
    const awareAt = new Date("2026-10-05T07:00:00.000Z");
    return db.issue.create({
      data: {
        number: permNumber++,
        entityId: revolut.id, type: "WRONG_MATCH", impact: "DEGRADED", possibleBreach: false,
        proposedSeverity: "SEV2", severity: "SEV2",
        description: "Throwaway permissions fixture created by issues.test.ts.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS",
        customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
        ownerTeam: "OPS", ownerId: kevin.id, ownerSince: awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "CUSTOMER_OWNER", clocksStartAt: awareAt, ackStartAt: awareAt, acknowledgedAt: awareAt,
        notifyRequired: true, notifyStartAt: awareAt, notifyTargetBusinessMins: 240, notifyDueAt: new Date(awareAt.getTime() + 300 * 60_000),
      },
    });
  }
  async function deletePermIssue(issueId: string) {
    await db.issueContributor.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }
  async function auditCount(issueId: string) {
    return db.auditEntry.count({ where: { objectType: "ISSUE", objectId: issueId } });
  }

  it("a forged owner action (change status, acknowledge, reassign, add contributor) from a non-owner returns 403 not_issue_owner and writes nothing", async () => {
    const issue = await createPermIssue();
    try {
      const forger = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } }); // Finance, not this issue's Ops owner
      const before = await auditCount(issue.id);

      await expect(changeIssueStatus(forger, issue.id, { status: "WAITING_ON_CUSTOMER", version: issue.version })).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
      await expect(acknowledgeIssue(forger, issue.id, { version: issue.version })).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
      await expect(reassignIssue(forger, issue.id, { newOwnerId: forger.id, reason: "forged reassignment attempt", version: issue.version })).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });
      await expect(addContributor(forger, issue.id, { userId: forger.id, version: issue.version })).rejects.toMatchObject({ code: "not_issue_owner", status: 403 });

      const after = await auditCount(issue.id);
      const unchanged = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(after).toBe(before);
      expect(unchanged.version).toBe(issue.version);
      expect(unchanged.status).toBe(issue.status);
    } finally {
      await deletePermIssue(issue.id);
    }
  });

  it("a forged communicator action (record communication, close) from a non-communicator returns 403 not_communicator and writes nothing", async () => {
    const issue = await createPermIssue();
    try {
      const forger = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } }); // Compliance, not this issue's communicator
      const before = await auditCount(issue.id);

      await expect(
        recordCommunication(forger, issue.id, { type: "UPDATE", occurredAt: new Date().toISOString(), channel: "EMAIL", personName: "Forged", message: "forged notification attempt, should be rejected", version: issue.version }),
      ).rejects.toMatchObject({ code: "not_communicator", status: 403 });
      await expect(
        closeIssue(forger, issue.id, { personName: "Forged", channel: "EMAIL", occurredAt: new Date().toISOString(), version: issue.version }),
      ).rejects.toMatchObject({ code: "not_communicator", status: 403 });

      const after = await auditCount(issue.id);
      const unchanged = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(after).toBe(before);
      expect(unchanged.version).toBe(issue.version);
    } finally {
      await deletePermIssue(issue.id);
    }
  });

  it("a direct call from the real owner with a stale version is rejected (409), not treated as a 403", async () => {
    const issue = await createPermIssue();
    try {
      const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
      await expect(acknowledgeIssue(kevin, issue.id, { version: issue.version + 1 })).rejects.toThrow();
      const stillNew = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(stillNew.version).toBe(issue.version);
    } finally {
      await deletePermIssue(issue.id);
    }
  });
});

describe("Fan-out and cascade (brief 4.9.8, M23) -- against the real Lloyds Bank plc / UK CoP / GB affected-customers shape", () => {
  let fanOutNumber = 9_500_000;

  // createLinkedIssues() is the real service: unlike every throwaway
  // fixture elsewhere in this file, its CREATE action never accepts an
  // explicit `number` -- it draws real values from issue_number_seq,
  // exactly as production reporting does. Snapshotting and restoring
  // the sequence around this describe block keeps that real side
  // effect from leaking into seed.test.ts's own "next number is
  // ISS-1043" assertion when both files run in the same `vitest run`.
  let seqBefore = 0;
  beforeAll(async () => {
    const [{ last_value }] = await db.$queryRawUnsafe<{ last_value: bigint }[]>("SELECT last_value FROM issue_number_seq");
    seqBefore = Number(last_value);
  });
  afterAll(async () => {
    await db.$executeRawUnsafe(`SELECT setval('issue_number_seq', ${seqBefore}, true)`);
  });

  /** A throwaway partner issue on Lloyds Bank plc, the same shape AC2's own worked example uses. */
  async function createPartnerIssue() {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    const awareAt = new Date("2026-10-05T06:55:00.000Z"); // 09:55 CEST, AC2's own example
    return db.issue.create({
      data: {
        number: fanOutNumber++,
        entityId: lloyds.id, scheme: "UK_COP", country: "GB",
        type: "PARTNER_DEGRADED", impact: "DOWN", possibleBreach: false,
        proposedSeverity: "SEV1", severity: "SEV1",
        description: "Lloyds CoP responses above 2 seconds and timeouts since 09:50 CEST. Throwaway fixture created by issues.test.ts.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: lukas.id, reporterTeam: "NETWORK",
        customerReporterKind: "FOUND_INTERNALLY", status: "NEW",
        ownerTeam: "NETWORK", ownerId: lukas.id, ownerSince: awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "ISSUE_OWNER_PARTNER",
        clocksStartAt: awareAt, ackStartAt: awareAt, ackDueAt: new Date(awareAt.getTime() + 15 * 60_000),
        notifyRequired: false,
      },
    });
  }

  /** Deletes a partner issue, every issue linked from it, and every row either one wrote. */
  async function deletePartnerIssue(parentId: string) {
    const links = await db.issueLink.findMany({ where: { parentId }, select: { childId: true } });
    for (const { childId } of links) {
      await db.issueContributor.deleteMany({ where: { issueId: childId } });
      await db.issueResolution.deleteMany({ where: { issueId: childId } });
      await db.issueNote.deleteMany({ where: { issueId: childId } });
      await db.issueCommunication.deleteMany({ where: { issueId: childId } });
      await db.complianceAssessment.deleteMany({ where: { issueId: childId } });
      await db.rootCauseReportTask.deleteMany({ where: { issueId: childId } });
      await db.historyEvent.deleteMany({ where: { issueId: childId } });
      await db.issueLink.deleteMany({ where: { childId } });
      await db.issue.delete({ where: { id: childId } });
    }
    await db.issueContributor.deleteMany({ where: { issueId: parentId } });
    await db.issueResolution.deleteMany({ where: { issueId: parentId } });
    await db.issueNote.deleteMany({ where: { issueId: parentId } });
    await db.issueCommunication.deleteMany({ where: { issueId: parentId } });
    await db.complianceAssessment.deleteMany({ where: { issueId: parentId } });
    await db.rootCauseReportTask.deleteMany({ where: { issueId: parentId } });
    await db.historyEvent.deleteMany({ where: { issueId: parentId } });
    await db.issue.delete({ where: { id: parentId } });
  }

  it("AC5, AC6: affected customers for Lloyds Bank plc UK CoP / GB lists Revolut Ltd, Santander UK plc and Lloyds Bank plc itself, sorted by Notify by; Zopa Bank Limited is before go-live", async () => {
    const parent = await createPartnerIssue();
    try {
      const result = await loadAffectedCustomers(parent.id, "UK_COP", "GB", "SEV1", parent.awareAt);
      const names = result.affected.map((a) => a.entityName);
      expect(names).toEqual(["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"]); // sorted by Notify by, earliest first (AC5's own worked example)
      expect(result.affected.find((a) => a.entityName === "Revolut Ltd")?.incidentNoticeHours).toBe(2);
      expect(result.affected.find((a) => a.entityName === "Santander UK plc")?.incidentNoticeHours).toBe(4);
      expect(result.affected.find((a) => a.entityName === "Lloyds Bank plc")?.incidentNoticeHours).toBe(8);
      expect(result.beforeGoLive.map((b) => b.entityName)).toContain("Zopa Bank Limited");
      expect(names).not.toContain("Monzo Bank Ltd"); // AC6: no UK CoP line at all
    } finally {
      await deletePartnerIssue(parent.id);
    }
  });

  // 15s, not the 5s default: createLinkedIssues()/acknowledgeIssue()/resolveIssue() are the real services, each several sequential round trips per child issue.
  it("AC7-AC9: create linked issues, one per ticked row, in one transaction, inheriting the parent's scheme/country/type/severity and routed to the parent's owner", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const santander = await db.entity.findFirstOrThrow({ where: { legalName: "Santander UK plc" } });
    try {
      const created = await createLinkedIssues(await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } }), parent.id, {
        version: parent.version,
        rows: [
          { action: "CREATE", entityId: revolut.id },
          { action: "CREATE", entityId: santander.id },
        ],
      });
      expect(created).toHaveLength(2);

      const revolutChild = await db.issue.findUniqueOrThrow({ where: { id: created[0].id } });
      expect(revolutChild.entityId).toBe(revolut.id);
      expect(revolutChild.scheme).toBe("UK_COP");
      expect(revolutChild.country).toBe("GB");
      expect(revolutChild.type).toBe("PARTNER_DEGRADED");
      expect(revolutChild.severity).toBe("SEV1");
      expect(revolutChild.routingRule).toBe("INHERITED_FROM_PARENT");
      expect(revolutChild.routingReason).toContain(`inherited from partner issue`);
      expect(revolutChild.ownerId).toBe(parent.ownerId); // AC7: owner = the partner issue's owner
      expect(revolutChild.ackStartAt).toBeNull(); // AC7: no acknowledge clock
      expect(revolutChild.status).toBe("NEW"); // parent not yet acknowledged
      expect(revolutChild.description).toContain(`Linked to ${issueDisplayId(parent.number)}`);
      expect(revolutChild.complianceFlaggedAt).not.toBeNull(); // Revolut Ltd is UK FCA, Sev-1: flagged
      expect(revolutChild.complianceAssessorId).not.toBeNull();

      const links = await db.issueLink.findMany({ where: { parentId: parent.id } });
      expect(links).toHaveLength(2);
      expect(links.every((l) => l.kind === "CREATED")).toBe(true);

      // AC7: default contributor is the customer's own named Ops person, never the partner's.
      const contributor = await db.issueContributor.findFirst({ where: { issueId: revolutChild.id } });
      expect(contributor?.isDefault).toBe(true);
    } finally {
      for (const c of await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } })) {
        await db.issueContributor.deleteMany({ where: { issueId: c.childId } });
        await db.complianceAssessment.deleteMany({ where: { issueId: c.childId } });
        await db.historyEvent.deleteMany({ where: { issueId: c.childId } });
      }
      await deletePartnerIssue(parent.id);
    }
  }, 15_000);

  it("AC8: attach defaults to 'Create a new linked issue' for a type other than Service unavailable or Partner degraded, to 'Attach' for those two", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" }, include: { owner: true } });
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    const openWrongMatch = await db.issue.create({
      data: {
        number: fanOutNumber++, entityId: revolut.id, scheme: "UK_COP", country: "GB",
        type: "WRONG_MATCH", impact: "ISOLATED_CASE", possibleBreach: false, proposedSeverity: "SEV3", severity: "SEV3",
        description: "Throwaway open issue, same entity/scheme/country as the partner issue fixture.",
        awareAt: parent.awareAt, reporterKind: "USER", reporterId: emma.id, reporterTeam: "CS",
        customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
        ownerTeam: "OPS", ownerId: revolut.ownerId, ownerSince: parent.awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "CUSTOMER_OWNER", clocksStartAt: parent.awareAt, ackStartAt: parent.awareAt, acknowledgedAt: parent.awareAt,
        notifyRequired: false,
      },
    });
    try {
      const result = await loadAffectedCustomers(parent.id, "UK_COP", "GB", "SEV1", parent.awareAt);
      const row = result.affected.find((a) => a.entityName === "Revolut Ltd")!;
      expect(row.attachCandidates.map((c) => c.id)).toContain(openWrongMatch.id);
      expect(row.defaultAction).toBe("CREATE"); // Wrong match result is neither Service unavailable nor Partner degraded
    } finally {
      await db.issue.delete({ where: { id: openWrongMatch.id } });
      await deletePartnerIssue(parent.id);
    }
  });

  it("AC17: acknowledging the parent moves a CREATED child from New to In progress; reassigning the parent's owner moves CREATED children with it, never an ATTACHED child", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    const nora = await db.user.findFirstOrThrow({ where: { name: "Nora Lee" } }); // Network, a valid reassignment target
    try {
      const [created] = await createLinkedIssues(lukas, parent.id, { version: parent.version, rows: [{ action: "CREATE", entityId: revolut.id }] });
      const attachedThrowaway = await db.issue.create({
        data: {
          number: fanOutNumber++, entityId: (await db.entity.findFirstOrThrow({ where: { legalName: "Santander UK plc" } })).id,
          scheme: "UK_COP", country: "GB", type: "SERVICE_UNAVAILABLE", impact: "DOWN", possibleBreach: false, proposedSeverity: "SEV1", severity: "SEV1",
          description: "Throwaway ATTACHED-kind fixture, must keep its own owner through the parent's owner sync.",
          awareAt: parent.awareAt, reporterKind: "USER", reporterId: lukas.id, reporterTeam: "NETWORK",
          customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
          ownerTeam: "OPS", ownerId: (await db.user.findFirstOrThrow({ where: { name: "Sophie Mitchell" } })).id, ownerSince: parent.awareAt,
          routingRule: "NAMED_PERSON", routingReason: "test fixture", communicatorRule: "CUSTOMER_OWNER",
          clocksStartAt: parent.awareAt, ackStartAt: parent.awareAt, acknowledgedAt: parent.awareAt, notifyRequired: false,
        },
      });
      const attachedOwnerIdBefore = attachedThrowaway.ownerId;
      await db.issueLink.create({ data: { parentId: parent.id, childId: attachedThrowaway.id, kind: "ATTACHED", createdById: lukas.id } });

      await acknowledgeIssue(lukas, parent.id, { version: (await db.issue.findUniqueOrThrow({ where: { id: parent.id } })).version });
      const createdAfterAck = await db.issue.findUniqueOrThrow({ where: { id: created.id } });
      expect(createdAfterAck.status).toBe("IN_PROGRESS"); // AC7: moves with the parent's acknowledge, no clock of its own

      const parentAfterAck = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      await reassignIssue(lukas, parent.id, { newOwnerId: nora.id, reason: "test fixture reassignment", version: parentAfterAck.version });

      const createdAfterReassign = await db.issue.findUniqueOrThrow({ where: { id: created.id } });
      expect(createdAfterReassign.ownerId).toBe(nora.id); // AC17: CREATED child follows the parent's new owner

      const attachedAfterReassign = await db.issue.findUniqueOrThrow({ where: { id: attachedThrowaway.id } });
      expect(attachedAfterReassign.ownerId).toBe(attachedOwnerIdBefore); // AC8: an ATTACHED child keeps its own owner

      await db.issueLink.deleteMany({ where: { childId: attachedThrowaway.id } });
      await db.issue.delete({ where: { id: attachedThrowaway.id } });
    } finally {
      for (const c of await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } })) {
        await db.issueContributor.deleteMany({ where: { issueId: c.childId } });
        await db.complianceAssessment.deleteMany({ where: { issueId: c.childId } });
        await db.historyEvent.deleteMany({ where: { issueId: c.childId } });
      }
      await deletePartnerIssue(parent.id);
    }
  }, 15_000);

  it("AC11, AC12: resolving the parent with active linked issues asks for confirmation first, then cascades the resolution to every open child and skips one already Resolved", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const santander = await db.entity.findFirstOrThrow({ where: { legalName: "Santander UK plc" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    try {
      const created = await createLinkedIssues(lukas, parent.id, {
        version: parent.version,
        rows: [
          { action: "CREATE", entityId: revolut.id },
          { action: "CREATE", entityId: santander.id },
        ],
      });
      // One child is already resolved on its own before the parent -- the cascade must skip it (M23 edge case 5).
      await db.issue.update({ where: { id: created[1].id }, data: { status: "RESOLVED", resolvedAt: now(), version: { increment: 1 } } });
      const preResolvedVersion = (await db.issue.findUniqueOrThrow({ where: { id: created[1].id } })).version;

      // Through the real service, not a raw update: acknowledging the parent is also what syncs a CREATED child from New to In progress (AC7).
      await acknowledgeIssue(lukas, parent.id, { version: parent.version });
      const parentAcknowledged = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });

      await expect(resolveIssue(lukas, parent.id, { rootCause: "Gateway overload after a configuration change on the partner's side, confirmed with their ops team.", solution: "Partner rolled back the change; response times recovered under one second.", version: parentAcknowledged.version })).rejects.toMatchObject({
        status: 409,
        needsConfirmation: true,
      });
      const stillInProgress = await db.issue.findUniqueOrThrow({ where: { id: created[0].id } });
      expect(stillInProgress.status).toBe("IN_PROGRESS"); // nothing changed yet -- this was a dry-run count

      await resolveIssue(lukas, parent.id, {
        rootCause: "Gateway overload after a configuration change on the partner's side, confirmed with their ops team.",
        solution: "Partner rolled back the change; response times recovered under one second.",
        version: parentAcknowledged.version,
        confirmCascade: true,
      });

      const revolutChild = await db.issue.findUniqueOrThrow({ where: { id: created[0].id } });
      expect(revolutChild.status).toBe("RESOLVED");
      const revolutResolution = await db.issueResolution.findFirstOrThrow({ where: { issueId: created[0].id } });
      expect(revolutResolution.cascadedFromIssueId).toBe(parent.id);
      const note = await db.issueNote.findFirstOrThrow({ where: { issueId: created[0].id, kind: "SYSTEM" } });
      expect(note.body).toContain(`Resolved with partner issue ${issueDisplayId(parent.number)}`);

      const santanderChild = await db.issue.findUniqueOrThrow({ where: { id: created[1].id } });
      expect(santanderChild.version).toBe(preResolvedVersion); // AC11: already-Resolved children stay unchanged

      // M27 AC1: the cascade creates a task on the Sev-1 customer issue (Revolut, 14 days), none on the partner issue and none on the child resolved before it.
      const revolutTask = await db.rootCauseReportTask.findUniqueOrThrow({ where: { issueId: created[0].id } });
      expect(revolutTask.reportDays).toBe(14);
      expect(revolutTask.dueAt!.getTime()).toBe(revolutChild.resolvedAt!.getTime() + 14 * 24 * 3_600_000);
      expect(await db.rootCauseReportTask.count({ where: { issueId: { in: [parent.id, created[1].id] } } })).toBe(0);
    } finally {
      for (const c of await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } })) {
        await db.issueContributor.deleteMany({ where: { issueId: c.childId } });
        await db.complianceAssessment.deleteMany({ where: { issueId: c.childId } });
        await db.historyEvent.deleteMany({ where: { issueId: c.childId } });
      }
      await deletePartnerIssue(parent.id);
    }
  }, 15_000);

  it("a linked issue resolved through the cascade accepts Compliance's assessment afterwards", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    try {
      const [child] = await createLinkedIssues(lukas, parent.id, { version: parent.version, rows: [{ action: "CREATE", entityId: revolut.id }] });
      await acknowledgeIssue(lukas, parent.id, { version: parent.version });
      const acknowledged = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      await resolveIssue(lukas, parent.id, { rootCause: "Gateway overload after a configuration change on the partner's side.", solution: "Partner rolled back the change.", version: acknowledged.version, confirmCascade: true });
      expect((await db.issue.findUniqueOrThrow({ where: { id: child.id } })).status).toBe("RESOLVED");

      const assessment = await recordComplianceAssessment(mei, child.id, { outcome: "POSSIBLE_MAJOR_INCIDENT", rationale: "Material CoP outage for a UK FCA customer, assessed after the quick resolution." });
      expect(assessment.outcome).toBe("POSSIBLE_MAJOR_INCIDENT");
      expect((await db.issue.findUniqueOrThrow({ where: { id: child.id } })).status).toBe("RESOLVED");
    } finally {
      for (const c of await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } })) {
        await db.issueContributor.deleteMany({ where: { issueId: c.childId } });
        await db.complianceAssessment.deleteMany({ where: { issueId: c.childId } });
        await db.historyEvent.deleteMany({ where: { issueId: c.childId } });
      }
      await deletePartnerIssue(parent.id);
    }
  }, 15_000);

  it("AC14: unlink leaves the child open with its current owner and out of the cascade", async () => {
    const parent = await createPartnerIssue();
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const lukas = await db.user.findFirstOrThrow({ where: { name: "Lukas Brenner" } });
    try {
      const [created] = await createLinkedIssues(lukas, parent.id, { version: parent.version, rows: [{ action: "CREATE", entityId: revolut.id }] });
      const link = await db.issueLink.findFirstOrThrow({ where: { parentId: parent.id, childId: created.id } });
      const ownerBeforeUnlink = (await db.issue.findUniqueOrThrow({ where: { id: created.id } })).ownerId;

      await unlinkIssue(lukas, link.id, { reason: "Revolut Ltd confirmed it was unaffected after all" });

      const unlinked = await db.issueLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(unlinked.unlinkedAt).not.toBeNull();
      const child = await db.issue.findUniqueOrThrow({ where: { id: created.id } });
      expect(child.ownerId).toBe(ownerBeforeUnlink); // keeps the owner it had at the moment of unlink
      expect(child.status).not.toBe("CLOSED");

      await acknowledgeIssue(lukas, parent.id, { version: parent.version });
      const parentAcknowledged = await db.issue.findUniqueOrThrow({ where: { id: parent.id } });
      await resolveIssue(lukas, parent.id, { rootCause: "Gateway overload after a configuration change on the partner's side, confirmed with their ops team.", solution: "Partner rolled back the change; response times recovered.", version: parentAcknowledged.version });
      const childAfterParentResolved = await db.issue.findUniqueOrThrow({ where: { id: created.id } });
      expect(childAfterParentResolved.status).toBe("NEW"); // the cascade no longer reaches an unlinked issue, and it was never synced to In progress either (unlinked before the parent's acknowledge)
    } finally {
      for (const c of await db.issueLink.findMany({ where: { parentId: parent.id }, select: { childId: true } })) {
        await db.issueContributor.deleteMany({ where: { issueId: c.childId } });
        await db.complianceAssessment.deleteMany({ where: { issueId: c.childId } });
        await db.historyEvent.deleteMany({ where: { issueId: c.childId } });
      }
      await deletePartnerIssue(parent.id);
    }
  }, 15_000);
});

describe("Compliance flag and assessment (brief 4.9.9, M25)", () => {
  it("AC4: the named Compliance person is the assessor inside Compliance hours; the on-call person on a Sev-1 outside them; the named person again, with a visibleFrom, below Sev-1 outside them", async () => {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const inHours = new Date("2026-10-05T06:00:00.000Z"); // 14:00 SGT, inside Compliance's 09:00-18:00 SGT
    const outOfHours = new Date("2026-10-05T18:00:00.000Z"); // 02:00 SGT next day, outside
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });

    const inHoursResult = await chooseComplianceAssessor(db, revolut.id, "SEV1", inHours);
    expect(inHoursResult.assessorId).toBe(mei.id); // the seed's named Compliance person for every entity is Mei Chen
    expect(inHoursResult.visibleFrom).toBeNull();

    const sev1OutOfHours = await chooseComplianceAssessor(db, revolut.id, "SEV1", outOfHours);
    expect(sev1OutOfHours.assessorId).not.toBeNull(); // the Compliance on-call person (also Mei Chen in the seed) or the named person as fallback
    expect(sev1OutOfHours.visibleFrom).toBeNull(); // Sev-1 is visible immediately, never deferred

    const sev3OutOfHours = await chooseComplianceAssessor(db, revolut.id, "SEV3", outOfHours);
    expect(sev3OutOfHours.assessorId).toBe(mei.id);
    expect(sev3OutOfHours.visibleFrom).not.toBeNull(); // rule 4: visible only from the next Compliance business start
  });

  let assessmentNumber = 9_600_000;
  async function createFlaggedIssue() {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    const awareAt = new Date("2026-10-05T07:00:00.000Z");
    return db.issue.create({
      data: {
        number: assessmentNumber++, entityId: revolut.id, type: "WRONG_MATCH", impact: "DOWN", possibleBreach: false,
        proposedSeverity: "SEV1", severity: "SEV1",
        description: "Throwaway Compliance-assessment fixture created by issues.test.ts.",
        awareAt, eventAt: new Date(awareAt.getTime() - 20 * 60_000), reporterKind: "USER", reporterId: kevin.id, reporterTeam: "OPS",
        customerReporterKind: "FOUND_INTERNALLY", status: "IN_PROGRESS",
        ownerTeam: "OPS", ownerId: kevin.id, ownerSince: awareAt, routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "CUSTOMER_OWNER", clocksStartAt: awareAt, ackStartAt: awareAt, acknowledgedAt: awareAt,
        notifyRequired: true, notifyStartAt: awareAt, notifyTargetHours: 2, notifyDueAt: new Date(awareAt.getTime() + 2 * 3_600_000),
        complianceFlaggedAt: awareAt, complianceReasons: ["Sev-1 at a regulated customer (UK FCA)"], complianceClockStartAt: awareAt, complianceAssessorId: mei.id,
      },
    });
  }
  async function deleteAssessmentIssue(issueId: string) {
    await db.complianceAssessment.deleteMany({ where: { issueId } });
    await db.historyEvent.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }

  it("AC6, AC7: records an assessment, stops the clock, and 'Neither' closes the flag with no clock started", async () => {
    const issue = await createFlaggedIssue();
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    try {
      const assessment = await recordComplianceAssessment(mei, issue.id, { outcome: "NEITHER", rationale: "Reviewed the transaction pattern: not a major incident and no data was exposed." });
      expect(assessment.outcome).toBe("NEITHER");
      const updated = await db.issue.findUniqueOrThrow({ where: { id: issue.id } });
      expect(updated.complianceClosedAt).not.toBeNull();
      const history = await db.historyEvent.findFirst({ where: { issueId: issue.id, summary: { contains: "Compliance assessment: Neither" } } });
      expect(history).not.toBeNull();
    } finally {
      await deleteAssessmentIssue(issue.id);
    }
  });

  it("an assessment is accepted while the issue is open or Resolved, and rejected once it is closed with the customer; the Assess step shows exactly then", async () => {
    const issue = await createFlaggedIssue();
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    const assessStep = async () => {
      const home = await loadWorklistIssues(mei, "mine");
      return home.main.find((r) => r.number === issue.number)?.view.line1 ?? null;
    };
    try {
      expect(await assessStep()).toEqual({ kind: "own", label: "Assess" }); // open
      await db.issue.update({ where: { id: issue.id }, data: { status: "RESOLVED", resolvedAt: now() } });
      expect(await assessStep()).toEqual({ kind: "own", label: "Assess" }); // Resolved: still offered, and the server accepts it
      await recordComplianceAssessment(mei, issue.id, { outcome: "POSSIBLE_MAJOR_INCIDENT", rationale: "Resolved quickly, but the bank still has a reporting duty." });
      expect(await db.complianceAssessment.count({ where: { issueId: issue.id } })).toBe(1);

      const unassessed = await db.issue.update({ where: { id: issue.id }, data: { status: "CLOSED", closedAt: now() } });
      await db.complianceAssessment.deleteMany({ where: { issueId: issue.id } });
      expect(await assessStep()).toBeNull(); // closed with the customer: the step is not open any more
      await expect(recordComplianceAssessment(mei, unassessed.id, { outcome: "NEITHER", rationale: "Too late: closed with the customer already." })).rejects.toMatchObject({ fieldErrors: { outcome: ["This issue is closed with the customer"] } });
    } finally {
      await deleteAssessmentIssue(issue.id);
    }
  });

  it("AC8: a second assessment is allowed while the issue is open; the block's history keeps both, newest first", async () => {
    const issue = await createFlaggedIssue();
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    try {
      await recordComplianceAssessment(mei, issue.id, { outcome: "POSSIBLE_MAJOR_INCIDENT", rationale: "Material impact for a UK FCA customer, escalating." });
      await recordComplianceAssessment(mei, issue.id, { outcome: "POSSIBLE_DATA_BREACH", rationale: "Further review found card data may have been exposed." });
      const assessments = await db.complianceAssessment.findMany({ where: { issueId: issue.id }, orderBy: { assessedAt: "desc" } });
      expect(assessments).toHaveLength(2);
      expect(assessments[0].outcome).toBe("POSSIBLE_DATA_BREACH");
      expect(assessments[1].outcome).toBe("POSSIBLE_MAJOR_INCIDENT");
    } finally {
      await deleteAssessmentIssue(issue.id);
    }
  });

  it("a forged assessment from a non-Compliance team returns 403 and writes nothing", async () => {
    const issue = await createFlaggedIssue();
    try {
      const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } }); // Customer Success, not Compliance
      const before = await db.complianceAssessment.count({ where: { issueId: issue.id } });
      await expect(recordComplianceAssessment(emma, issue.id, { outcome: "NEITHER", rationale: "Forged attempt, should be rejected by the team gate." })).rejects.toMatchObject({ status: 403 });
      const after = await db.complianceAssessment.count({ where: { issueId: issue.id } });
      expect(after).toBe(before);
    } finally {
      await deleteAssessmentIssue(issue.id);
    }
  });
});

describe("Issues worklist (brief 4.6.9, M20) -- the 7.1.17.8 oracles", () => {
  it("Tom Hadley (Sales) sees ISS-1031 only under Contributing, with 'Owner: Rachel Wong (Finance)'; his one Issues row is the Totta coverage question he owns", async () => {
    const tom = await db.user.findFirstOrThrow({ where: { name: "Tom Hadley" } });
    const result = await loadWorklistIssues(tom, "mine");
    expect(result.main.map((r) => r.number)).toEqual([1023]);
    const row = result.contributing.find((r) => r.number === 1031)!;
    expect(row.ownerLabel).toBe("Owner: Rachel Wong (Finance)");
    expect(result.reported).toHaveLength(0);
  });

  it("Rachel Wong (Finance) sees ISS-1031 as Owner with the step Reply to customer, among her four billing issues: Issues (4), badge 4", async () => {
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    const result = await loadWorklistIssues(rachel, "mine");
    expect(result.main.map((r) => r.number).sort()).toEqual([1021, 1022, 1024, 1031]);
    const row = result.main.find((r) => r.number === 1031)!;
    expect(row.roleLabel).toBe("Owner");
    // A billing question has a Reply to customer deadline (5 business days) that leads; Resolve (10 business days) is the second step.
    expect(row.stepText).toBe("Reply to customer");
    expect(row.moreStepsCount).toBe(1);
    expect(result.count).toBe(4);
    expect(result.badgeCount).toBe(4);
  });

  it("Mei Chen (Compliance) has no row for ISS-1042 (assessed); her one row is the open Assess on the UniCredit Sev-1, ISS-1029", async () => {
    const mei = await db.user.findFirstOrThrow({ where: { name: "Mei Chen" } });
    const result = await loadWorklistIssues(mei, "mine");
    expect(result.main.map((r) => r.number)).toEqual([1029]);
    expect(result.main[0].view.line1).toEqual({ kind: "own", label: "Assess" });
    expect(result.count).toBe(1);
    expect(result.badgeCount).toBe(1);
  });

  it("Ops 'My team' scope shows one row per issue, led by the most urgent open action (the customer updates, on ISS-1038 and ISS-1042)", async () => {
    // 7.1.17.8's "[Fri 02 Oct, 08:00 CEST]" row -- the one DEMO_CLOCK_START=...+03:00 (Europe/Bucharest,
    // "+03:00" is CEST+1h) actually seeds: before Emma Wilson's 09:00 CEST hand-over start, so ISS-1042's
    // on-call owner Kevin Lim is still its own communicator too. Role actions PR: My team is one row per
    // issue (not one per team member), its time block and line 1 those of the most urgent open action.
    const adrian = await db.user.findFirstOrThrow({ where: { name: "Adrian Koh" } });
    const result = await loadWorklistIssues(adrian, "team");
    const numbers = result.main.map((r) => r.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toEqual(expect.arrayContaining([1038, 1042]));
    // The lead is the one with the nearest deadline: Kevin's update on ISS-1042 (he is still its communicator), Adrian's update on ISS-1038.
    const lead: Record<number, string> = { 1038: "Adrian Koh", 1042: "Kevin Lim" };
    for (const row of result.main.filter((r) => r.number === 1038 || r.number === 1042)) {
      expect(row.view.scope).toBe("team");
      expect(row.view.line1).toMatchObject({ kind: "person", person: lead[row.number] });
      expect(row.view.timePerson).toBe(lead[row.number]);
    }
  });

  it("M20 AC8: a rule-4 (queued) issue stays out of the customer owner's main list before clocksStartAt, and the reporter sees 'Queued until' under Reported by me", async () => {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" }, include: { owner: true } });
    const customerOwner = revolut.owner!; // rule 4 leaves Issue.ownerId null, but CUSTOMER_OWNER still resolves the communicator to Entity.ownerId regardless
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    const future = new Date(now().getTime() + 48 * 3_600_000); // clocks start two real days from now -- always still in the future
    const queued = await db.issue.create({
      data: {
        number: 9_700_001, entityId: revolut.id, type: "COMMERCIAL_COVERAGE", impact: "QUESTION_OR_REQUEST", possibleBreach: false,
        proposedSeverity: "SEV4", severity: "SEV4",
        description: "Throwaway rule-4 queued fixture created by issues.test.ts.",
        awareAt: now(), reporterKind: "USER", reporterId: emma.id, reporterTeam: "CS",
        customerReporterKind: "FOUND_INTERNALLY", status: "NEW",
        ownerTeam: "SALES", ownerId: null, ownerSince: null, routingRule: "QUEUED_FOR_BUSINESS_HOURS", routingReason: "test fixture",
        communicatorRule: "CUSTOMER_OWNER", clocksStartAt: future, ackStartAt: null, notifyRequired: false,
      },
    });
    try {
      const ownerResult = await loadWorklistIssues(customerOwner, "mine");
      expect(ownerResult.main.some((r) => r.number === 9_700_001)).toBe(false); // AC8: absent from the communicator's main list until clocksStartAt

      const reporterResult = await loadWorklistIssues(emma, "mine");
      const reportedRow = reporterResult.reported.find((r) => r.number === 9_700_001);
      expect(reportedRow).toBeDefined();
      expect(reportedRow?.queuedUntil).not.toBeNull(); // "Queued until <time in the viewer's time zone>"
    } finally {
      await db.issue.delete({ where: { id: queued.id } });
    }
  });
});

describe("Resolved, waiting for the customer (PO decision, DECISIONS.md) -- grouping by role", () => {
  async function createResolvedFixture(number: number, ownerId: string, contributorId: string) {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" }, include: { owner: true } });
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    // communicatorRule ISSUE_OWNER_UNTIL_HANDOVER with handoverAt in the past: the
    // effective communicator is the *entity's* owner (Revolut's own Adrian Koh),
    // deliberately a different person from the issue's own ownerId below, so owner
    // and communicator are two distinct roles to assert on separately.
    const issue = await db.issue.create({
      data: {
        number, entityId: revolut.id, type: "COMMERCIAL_COVERAGE", impact: "QUESTION_OR_REQUEST", possibleBreach: false,
        proposedSeverity: "SEV4", severity: "SEV4",
        description: "Throwaway resolved-waiting fixture created by issues.test.ts.",
        awareAt: now(), reporterKind: "USER", reporterId: emma.id, reporterTeam: "CS",
        customerReporterKind: "FOUND_INTERNALLY", status: "RESOLVED", resolvedAt: now(),
        ownerTeam: "OPS", ownerId, ownerSince: now(),
        routingRule: "NAMED_PERSON", routingReason: "test fixture",
        communicatorRule: "ISSUE_OWNER_UNTIL_HANDOVER", handoverAt: new Date(now().getTime() - 3_600_000),
        clocksStartAt: now(), ackStartAt: now(), acknowledgedAt: now(), notifyRequired: false,
        contributors: { create: [{ userId: contributorId }] },
      },
    });
    return { issue, entityOwner: revolut.owner! };
  }

  async function deleteResolvedFixture(issueId: string) {
    // loadWorklistIssues() itself calls ensureSystemWrites() on every candidate issue
    // it loads, including this fixture (its past handoverAt makes the hand-over due) --
    // that writes its own IssueCommunication/IssueNote rows as a side effect, so
    // cleanup needs all of this issue's own child rows, not just IssueContributor.
    await db.issueContributor.deleteMany({ where: { issueId } });
    await db.issueNote.deleteMany({ where: { issueId } });
    await db.issueCommunication.deleteMany({ where: { issueId } });
    await db.issue.delete({ where: { id: issueId } });
  }

  it("Owner (not communicator): moves to resolvedWaiting, not main, and isn't counted as open/needs action", async () => {
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    const before = await loadWorklistIssues(kevin, "mine");
    const { issue } = await createResolvedFixture(9_700_002, kevin.id, rachel.id);
    try {
      const result = await loadWorklistIssues(kevin, "mine");
      expect(result.main.some((r) => r.number === 9_700_002)).toBe(false);
      const row = result.resolvedWaiting.find((r) => r.number === 9_700_002);
      expect(row).toBeDefined();
      expect(row?.roleLabel).toBe("Owner");
      expect(result.count).toBe(before.count); // the new resolved issue didn't change "open, needs action" for the owner
    } finally {
      await deleteResolvedFixture(issue.id);
    }
  });

  it("Contributor (not owner, not communicator): moves to resolvedWaiting, not contributing, and isn't counted as open/needs action", async () => {
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    const before = await loadWorklistIssues(rachel, "mine");
    const { issue } = await createResolvedFixture(9_700_003, kevin.id, rachel.id);
    try {
      const result = await loadWorklistIssues(rachel, "mine");
      expect(result.contributing.some((r) => r.number === 9_700_003)).toBe(false);
      const row = result.resolvedWaiting.find((r) => r.number === 9_700_003);
      expect(row).toBeDefined();
      expect(row?.roleLabel).toBe("Contributor");
      expect(result.count).toBe(before.count);
    } finally {
      await deleteResolvedFixture(issue.id);
    }
  });

  it("Communicator: stays in main with 'Confirm resolution with the customer', never in resolvedWaiting", async () => {
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    const { issue, entityOwner } = await createResolvedFixture(9_700_004, kevin.id, rachel.id);
    try {
      const result = await loadWorklistIssues(entityOwner, "mine");
      const row = result.main.find((r) => r.number === 9_700_004);
      expect(row).toBeDefined();
      expect(row?.roleLabel).toBe("Communicator");
      expect(row?.stepText).toBe("Confirm resolution with the customer");
      expect(result.resolvedWaiting.some((r) => r.number === 9_700_004)).toBe(false);
      expect(result.count).toBeGreaterThanOrEqual(1); // still counts as "open, needs action" for the communicator
    } finally {
      await deleteResolvedFixture(issue.id);
    }
  });

  it("Team scope: the owner's resolved row appears in resolvedWaiting under a teammate's 'My team' view, by name, while the communicator's own row stays in main", async () => {
    const kevin = await db.user.findFirstOrThrow({ where: { name: "Kevin Lim" } });
    const rachel = await db.user.findFirstOrThrow({ where: { name: "Rachel Wong" } });
    const { issue, entityOwner } = await createResolvedFixture(9_700_005, kevin.id, rachel.id);
    try {
      const result = await loadWorklistIssues(entityOwner, "team"); // entityOwner (Adrian Koh) is Ops, team-scope eligible
      const kevinResolvedRow = result.resolvedWaiting.find((r) => r.number === 9_700_005 && r.personName === "Kevin Lim");
      expect(kevinResolvedRow).toBeDefined();
      expect(result.main.some((r) => r.number === 9_700_005 && r.personName === "Kevin Lim")).toBe(false);
      const ownRow = result.main.find((r) => r.number === 9_700_005 && r.roleLabel === "Communicator");
      expect(ownRow).toBeDefined();
    } finally {
      await deleteResolvedFixture(issue.id);
    }
  });
});

describe("Similar-issues age never shows negative (demo-clock bug fix, DECISIONS.md)", () => {
  it("clamps ageDays at 0 and still returns the row when createdAt somehow lands after the demo clock's \"today\"", async () => {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const emma = await db.user.findFirstOrThrow({ where: { name: "Emma Wilson" } });
    const issue = await db.issue.create({
      data: {
        number: 9_700_006, entityId: revolut.id, scheme: "UK_COP", country: "GB", type: "COMMERCIAL_COVERAGE", impact: "QUESTION_OR_REQUEST", possibleBreach: false,
        proposedSeverity: "SEV4", severity: "SEV4",
        description: "Throwaway ageDays-clamp fixture created by issues.test.ts.",
        awareAt: now(), reporterKind: "USER", reporterId: emma.id, reporterTeam: "CS",
        customerReporterKind: "FOUND_INTERNALLY", status: "NEW",
        ownerTeam: "OPS", ownerId: emma.id, ownerSince: now(),
        routingRule: "NAMED_PERSON", routingReason: "test fixture",
        clocksStartAt: now(), ackStartAt: now(), notifyRequired: false,
      },
    });
    try {
      // The real bug this guards: a row whose createdAt is in the future relative
      // to the demo clock's "today" (exactly what writing createdAt from the
      // database's own real-time @default(now()) produced before the fix, when
      // the demo clock is set behind the real calendar date).
      const fiveDaysAheadOfDemoClock = new Date(now().getTime() + 5 * 24 * 60 * 60 * 1000);
      await db.issue.update({ where: { id: issue.id }, data: { createdAt: fiveDaysAheadOfDemoClock } });
      const rows = await loadSimilarIssues(revolut.id, "UK_COP", "GB");
      const row = rows.find((r) => r.number === 9_700_006);
      expect(row).toBeDefined();
      expect(row?.ageDays).toBe(0);
    } finally {
      await db.issue.delete({ where: { id: issue.id } });
    }
  });
});
