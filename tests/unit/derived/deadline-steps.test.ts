import { describe, expect, it } from "vitest";

import type { Calendar } from "@/lib/business-hours";
import { computeDeadlines, deadlineFactsOf, type Deadline, type DeadlineFacts } from "@/server/derived/deadlines";
import { roleActionsFor, type RoleActionIssue } from "@/server/derived/role-actions";
import { pickTime } from "@/server/queries/worklist/issues";
import type { ClockResult } from "@/server/derived/issue-clocks";

const CAL: Calendar = { timeZone: "Europe/Amsterdam", start: "09:00", end: "18:00", weekdays: [1, 2, 3, 4, 5] };
const NOW = new Date("2026-10-05T10:05:00+02:00");
const at = (iso: string) => new Date(iso);
const MIN = 60_000;

const kevin = { id: "u-kevin", name: "Kevin Lim" };
const emma = { id: "u-emma", name: "Emma Wilson" };
const lukas = { id: "u-lukas", name: "Lukas Brenner" };

const none: ClockResult = { state: "not_required", text: "", dueAt: null, overdue: false };

const facts = (over: Partial<DeadlineFacts> = {}): DeadlineFacts => ({
  severity: "SEV1",
  status: "IN_PROGRESS",
  type: "SERVICE_UNAVAILABLE",
  isPartnerIssue: false,
  isLinkedChild: false,
  awareAt: at("2026-10-04T21:12:00+02:00"),
  notifyRequired: true,
  notifiedAt: at("2026-10-04T22:05:00+02:00"),
  lastUpdateAt: at("2026-10-05T06:30:00+02:00"),
  restoredAt: at("2026-10-04T22:30:00+02:00"),
  resolvedAt: null,
  closureConfirmedAt: null,
  repliedAt: null,
  waitingOnCustomerSince: null,
  pausedMinutes: 0,
  pausedBusinessMinutes: 0,
  factsHours: 2,
  factsStartAt: at("2026-10-04T21:58:00+02:00"),
  factsSentAt: at("2026-10-04T22:40:00+02:00"),
  lastPartnerContactAt: null,
  ...over,
});

function issue(over: Partial<RoleActionIssue> = {}, f: Partial<DeadlineFacts> = {}): RoleActionIssue {
  const deadlines: Deadline[] = computeDeadlines(facts(f), { owner: CAL, communicator: CAL }, NOW);
  return {
    issueId: "i1",
    number: 1042,
    status: "IN_PROGRESS",
    severity: "SEV1",
    entityName: "Banca Monte dei Paschi di Siena S.p.A.",
    isPartnerIssue: false,
    owner: kevin,
    communicator: emma,
    complianceAssessor: null,
    contributorIds: [],
    clocksStartAt: at("2026-10-04T21:12:00+02:00"),
    acknowledgedAt: at("2026-10-04T21:21:00+02:00"),
    acknowledgedByName: "Kevin Lim",
    notifyRequired: true,
    notifiedAt: at("2026-10-04T22:05:00+02:00"),
    notifiedByName: "Kevin Lim",
    complianceFlaggedAt: null,
    complianceClosedAt: null,
    complianceVisibleFrom: null,
    firstAssessment: null,
    inheritedFrom: null,
    clocks: { acknowledge: none, notify: none, compliance: null },
    deadlines,
    restored: { at: at("2026-10-04T22:30:00+02:00"), byName: "Kevin Lim", note: "Certificate renewed." },
    factsSent: { at: at("2026-10-04T22:40:00+02:00"), byName: "Kevin Lim" },
    ...over,
  };
}

describe("the deadline model as steps (ISS-1042 at Mon 10:05, as the seed has it)", () => {
  it("Emma's next action is the customer update, due at 10:30, restarting at every update", () => {
    const v = roleActionsFor(issue(), emma.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "update", role: "Communicator", label: "Send update to Banca Monte dei Paschi di Siena S.p.A.", timeLabel: "Update" });
    expect(v.mine[0].dueAt).toEqual(at("2026-10-05T10:30:00+02:00"));
    expect(v.mine[0].clock).toMatchObject({ key: "update", repeating: true, targetMinutes: 240 });
    expect(v.mine[0].subLine).toBe("Every 1 h until the service is restored, then every 4 h");
  });

  it("Kevin has the restore step done (with the note) and only Resolve left, with no clock at Sev-1", () => {
    const v = roleActionsFor(issue(), kevin.id, NOW);
    expect(v.mine.map((a) => a.key)).toEqual(["investigate"]);
    expect(v.mine[0].dueAt).toBeNull();
    const restore = v.done.find((a) => a.key === "restore")!;
    expect(restore.done).toMatchObject({ label: "Service restored", byName: "Kevin Lim" });
    expect(restore.doneNote).toBe("Certificate renewed.");
    expect(restore.done!.timing).toMatchObject({ lateMinutes: null });
    expect(restore.done!.timing!.elapsedMinutes).toBe(78);
    expect(v.done.find((a) => a.key === "facts")?.done).toMatchObject({ label: "Facts sent to the regulator", byName: "Kevin Lim" });
  });

  it("before the restore, Kevin's step is Restore service with its 4 h deadline, and the update cadence is 60 minutes", () => {
    const f = { restoredAt: null, lastUpdateAt: at("2026-10-05T09:40:00+02:00") };
    const v = roleActionsFor(issue({ restored: null }, f), kevin.id, NOW);
    const restore = v.mine.find((a) => a.key === "restore")!;
    expect(restore.dueAt).toEqual(at("2026-10-05T01:12:00+02:00")); // overdue by 8 h 53 min: a night Sev-1 nobody restored
    expect(restore.subLine).toBe("4 h after Corvane aware at");
    const update = roleActionsFor(issue({ restored: null }, f), emma.id, NOW).mine.find((a) => a.key === "update")!;
    expect(update.dueAt).toEqual(at("2026-10-05T10:40:00+02:00"));
  });

  it("the facts step shows for the communicator while open, and goes once sent", () => {
    const open = roleActionsFor(issue({ factsSent: null }, { factsSentAt: null }), emma.id, NOW);
    expect(open.mine.map((a) => a.key)).toContain("facts");
    expect(open.mine.find((a) => a.key === "facts")!.dueAt).toEqual(at("2026-10-04T23:58:00+02:00"));
    expect(roleActionsFor(issue(), emma.id, NOW).mine.map((a) => a.key)).not.toContain("facts");
  });

  it("a Resolved issue: Confirm resolution gets 1 business day, and the updates stop", () => {
    const f = { status: "RESOLVED" as const, resolvedAt: at("2026-10-05T09:00:00+02:00") };
    const i = issue({ status: "RESOLVED", resolved: { at: f.resolvedAt, byId: kevin.id, byName: "Kevin Lim" } }, f);
    const v = roleActionsFor(i, emma.id, NOW);
    expect(v.mine.map((a) => a.key)).toEqual(["close"]);
    expect(v.mine[0].dueAt).toEqual(at("2026-10-05T18:00:00+02:00")); // 09:00 plus one business day of 540 minutes
  });

  it("Waiting on customer: Resolve and Restore are paused, with no due time, and the pause is named", () => {
    const f = { severity: "SEV2" as const, restoredAt: null, status: "WAITING_ON_CUSTOMER" as const, waitingOnCustomerSince: at("2026-10-05T09:40:00+02:00"), awareAt: at("2026-10-05T09:00:00+02:00"), type: "SERVICE_UNAVAILABLE" as const };
    const i = issue({ status: "WAITING_ON_CUSTOMER", severity: "SEV2", restored: null }, f);
    const v = roleActionsFor(i, kevin.id, NOW);
    const restore = v.mine.find((a) => a.key === "restore")!;
    expect(restore.dueAt).toBeNull();
    expect(restore.paused).toMatchObject({ label: "Waiting on customer" });
    const resolve = v.mine.find((a) => a.key === "investigate")!;
    expect(resolve.paused).toBeDefined();
  });

  it("a partner issue has Chase, restarting at each contact, and no customer update", () => {
    const f = { isPartnerIssue: true, type: "PARTNER_DEGRADED" as const, notifyRequired: false, notifiedAt: null, severity: "SEV2" as const, awareAt: at("2026-10-05T08:00:00+02:00"), restoredAt: null, lastPartnerContactAt: at("2026-10-05T09:30:00+02:00"), factsHours: null, factsStartAt: null, factsSentAt: null };
    const i = issue({ isPartnerIssue: true, entityName: "ING-DiBa AG", owner: lukas, communicator: lukas, severity: "SEV2", notifyRequired: false, notifiedAt: null, restored: null, factsSent: null }, f);
    const v = roleActionsFor(i, lukas.id, NOW);
    const chase = v.mine.find((a) => a.key === "chase")!;
    expect(chase).toMatchObject({ label: "Chase ING-DiBa AG", timeLabel: "Chase", clock: { repeating: true } });
    expect(chase.dueAt).toEqual(at("2026-10-05T13:30:00+02:00")); // 4 business hours after the contact at 09:30
    expect(v.mine.map((a) => a.key)).not.toContain("update");
  });

  it("a BILLING issue has Reply to customer for its owner, and no Restore", () => {
    const f = { type: "BILLING" as const, severity: "SEV3" as const, awareAt: at("2026-10-01T10:40:00+02:00"), notifyRequired: false, notifiedAt: null, restoredAt: null, factsHours: null, factsStartAt: null, factsSentAt: null, lastUpdateAt: null };
    const i = issue({ severity: "SEV3", notifyRequired: false, notifiedAt: null, restored: null, factsSent: null, communicator: emma }, f);
    const v = roleActionsFor(i, kevin.id, NOW);
    expect(v.mine.map((a) => a.key).sort()).toEqual(["investigate", "reply"]);
    expect(v.mine.find((a) => a.key === "reply")!.dueAt).toEqual(at("2026-10-08T10:40:00+02:00"));
  });
});

describe("the Home Time column: the issue's nearest open deadline, whoever owns it", () => {
  it("shows Emma's own update as hers (bold) on her Home", () => {
    const rav = roleActionsFor(issue(), emma.id, NOW);
    const t = pickTime(rav, "mine", "IN_PROGRESS")!;
    expect(t).toMatchObject({ own: true, person: "Emma Wilson", label: "Update", paused: null });
    expect(new Date(t.dueAt!)).toEqual(at("2026-10-05T10:30:00+02:00"));
    expect(t.soonAt).not.toBeNull();
  });

  it("shows somebody else's on Kevin's Home: the update, secondary, with the person and the clock's name", () => {
    const rav = roleActionsFor(issue(), kevin.id, NOW);
    const t = pickTime(rav, "mine", "IN_PROGRESS")!;
    expect(t).toMatchObject({ own: false, person: "Emma Wilson", label: "Update" });
    expect(new Date(t.dueAt!)).toEqual(at("2026-10-05T10:30:00+02:00"));
  });

  // Kevin's own Restore (before the restore) is overdue and nearer than Emma's update, which is her own deadline on this issue.
  const nearerOfSomeoneElse = () => roleActionsFor(issue({ restored: null }, { restoredAt: null, lastUpdateAt: at("2026-10-05T09:40:00+02:00") }), emma.id, NOW);

  it("Mine: my own deadline on the issue wins, even when somebody else's is nearer", () => {
    const t = pickTime(nearerOfSomeoneElse(), "mine", "IN_PROGRESS")!;
    expect(t).toMatchObject({ own: true, person: "Emma Wilson", label: "Update" });
  });

  it("My team: the nearest of anyone wins, even when I have a deadline of my own", () => {
    const t = pickTime(nearerOfSomeoneElse(), "team", "IN_PROGRESS")!;
    expect(t).toMatchObject({ own: false, person: "Kevin Lim", label: "Restore" });
  });

  it("Mine: with no deadline of my own on the issue, the nearest of anyone's shows, secondary", () => {
    const rav = roleActionsFor(issue({ restored: null }, { restoredAt: null, lastUpdateAt: at("2026-10-05T09:40:00+02:00") }), "u-nobody", NOW);
    expect(pickTime(rav, "mine", "IN_PROGRESS")).toMatchObject({ own: false, person: "Kevin Lim", label: "Restore" });
  });

  it("in the team scope nothing is 'own': the nearest is shown with its person", () => {
    const rav = roleActionsFor(issue(), emma.id, NOW);
    expect(pickTime(rav, "team", "IN_PROGRESS")).toMatchObject({ own: false, person: "Emma Wilson" });
  });

  it("is null only when the issue has no open clock at all", () => {
    const rav = roleActionsFor(issue({ deadlines: [] }), kevin.id, NOW);
    // Kevin still has Investigate (no deadline) as an open step, but no clock: nothing to show.
    expect(pickTime(rav, "mine", "IN_PROGRESS")).toBeNull();
  });

  it("a paused clock reads as paused when nothing else runs", () => {
    const f = { severity: "SEV2" as const, restoredAt: null, status: "WAITING_ON_CUSTOMER" as const, waitingOnCustomerSince: at("2026-10-05T09:40:00+02:00"), awareAt: at("2026-10-05T09:00:00+02:00"), notifyRequired: false, notifiedAt: null, lastUpdateAt: null, factsHours: null, factsStartAt: null, factsSentAt: null };
    const rav = roleActionsFor(issue({ status: "WAITING_ON_CUSTOMER", severity: "SEV2", notifyRequired: false, notifiedAt: null, restored: null, factsSent: null }, f), kevin.id, NOW);
    const t = pickTime(rav, "mine", "WAITING_ON_CUSTOMER")!;
    expect(t.paused).toMatchObject({ label: "Waiting on customer" });
    expect(t.dueAt).toBeNull();
  });

  it("an issue Waiting on partner shows the partner chase as its clock", () => {
    const f = { isPartnerIssue: true, type: "PARTNER_DEGRADED" as const, notifyRequired: false, notifiedAt: null, severity: "SEV2" as const, awareAt: at("2026-10-05T08:00:00+02:00"), restoredAt: null, status: "WAITING_ON_PARTNER" as const, lastPartnerContactAt: at("2026-10-05T09:30:00+02:00"), factsHours: null, factsStartAt: null, factsSentAt: null, lastUpdateAt: null };
    const i = issue({ isPartnerIssue: true, entityName: "ING-DiBa AG", owner: lukas, communicator: lukas, severity: "SEV2", status: "WAITING_ON_PARTNER", notifyRequired: false, notifiedAt: null, restored: null, factsSent: null }, f);
    const t = pickTime(roleActionsFor(i, lukas.id, NOW), "mine", "WAITING_ON_PARTNER")!;
    expect(t.label).toBe("Chase");
    expect(t.own).toBe(true);
  });
});

describe("deadlineFactsOf reads the facts of an issue", () => {
  const base = {
    issue: { severity: "SEV1" as const, status: "IN_PROGRESS" as const, type: "SERVICE_UNAVAILABLE" as const, communicatorRule: "ISSUE_OWNER_UNTIL_HANDOVER", routingRule: "NEW_REPORT", awareAt: at("2026-10-04T21:12:00+02:00"), notifyRequired: true, notifiedAt: at("2026-10-04T22:05:00+02:00"), restoredAt: null, resolvedAt: null, waitingOnCustomerSince: null, pausedMinutes: 0, pausedBusinessMinutes: 0 },
    communications: [
      { type: "FIRST_NOTIFICATION" as const, occurredAt: at("2026-10-04T22:05:00+02:00") },
      { type: "UPDATE" as const, occurredAt: at("2026-10-04T23:00:00+02:00") },
      { type: "UPDATE" as const, occurredAt: at("2026-10-05T06:30:00+02:00") },
      { type: "FACTS_PACK_SENT" as const, occurredAt: at("2026-10-04T22:40:00+02:00") },
    ],
    assessments: [{ outcome: "POSSIBLE_MAJOR_INCIDENT" as const, assessedAt: at("2026-10-04T21:58:00+02:00") }],
    card: { factsNeededHours: 2, regulatoryRegime: "EU_DORA" as const },
  };

  it("takes the latest update, the first reply and the facts pack from the communications", () => {
    const f = deadlineFactsOf(base);
    expect(f.lastUpdateAt).toEqual(at("2026-10-05T06:30:00+02:00"));
    expect(f.repliedAt).toEqual(at("2026-10-04T22:05:00+02:00"));
    expect(f.factsSentAt).toEqual(at("2026-10-04T22:40:00+02:00"));
    expect(f.factsHours).toBe(2);
    expect(f.factsStartAt).toEqual(at("2026-10-04T21:58:00+02:00"));
  });

  it("asks for facts only at Sev-1, with a regulated customer, a possible major incident and hours on the card", () => {
    expect(deadlineFactsOf({ ...base, issue: { ...base.issue, severity: "SEV2" } }).factsHours).toBeNull();
    expect(deadlineFactsOf({ ...base, card: { factsNeededHours: 2, regulatoryRegime: "NONE" } }).factsHours).toBeNull();
    expect(deadlineFactsOf({ ...base, card: { factsNeededHours: null, regulatoryRegime: "EU_DORA" } }).factsHours).toBeNull();
    expect(deadlineFactsOf({ ...base, card: null }).factsHours).toBeNull();
    expect(deadlineFactsOf({ ...base, assessments: [{ outcome: "NEITHER", assessedAt: at("2026-10-04T21:58:00+02:00") }] }).factsHours).toBeNull();
    expect(deadlineFactsOf({ ...base, issue: { ...base.issue, communicatorRule: "ISSUE_OWNER_PARTNER" } }).factsHours).toBeNull();
  });

  it("a linked issue is recognised by its routing rule", () => {
    expect(deadlineFactsOf({ ...base, issue: { ...base.issue, routingRule: "INHERITED_FROM_PARENT" } }).isLinkedChild).toBe(true);
  });
});

void MIN;

describe("the owner's step is Monitor and resolve once the service is restored", () => {
  const stepOf = (i: RoleActionIssue) => roleActionsFor(i, kevin.id, NOW).open.find((a) => a.key === "investigate")!;

  it("after Service restored: 'Monitor and resolve ISS-1042', Home short label 'Monitor and resolve'", () => {
    expect(stepOf(issue())).toMatchObject({ label: "Monitor and resolve ISS-1042", shortLabel: "Monitor and resolve" });
  });

  it("before it (or on an issue with no restore step): 'Investigate and resolve', short label 'Investigate'", () => {
    expect(stepOf(issue({ restored: null }, { restoredAt: null }))).toMatchObject({ label: "Investigate and resolve ISS-1042", shortLabel: "Investigate" });
  });
});

describe("a waiting Confirm step says its target: 1 business day at Sev-1 and Sev-2, nothing below", () => {
  const planned = (severity: "SEV1" | "SEV2" | "SEV3") =>
    roleActionsFor(issue({ planned: true, severity, status: "IN_PROGRESS" }, { severity }), kevin.id, NOW).plan.find((a) => a.key === "close")!;

  it("Sev-1 and Sev-2: '1 business day', after resolution", () => {
    for (const sev of ["SEV1", "SEV2"] as const) expect(planned(sev)).toMatchObject({ state: "blocked", plannedText: "1 business day", afterNote: "after resolution" });
  });

  it("Sev-3: no target, so nothing is written (not '10 business days')", () => {
    expect(planned("SEV3").plannedText).toBeNull();
  });
});
