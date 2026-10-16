import { describe, expect, it } from "vitest";

import { addBusinessMinutes, teamCalendar } from "@/lib/business-hours";

import { allRoleActions, compareHomeRows, roleActionsFor, type HomeSortKey, type RoleActionIssue } from "@/server/derived/role-actions";
import { computeClocks, type ClockResult, type ComputedClocks } from "@/server/derived/issue-clocks";

const NOW = new Date("2026-10-05T08:48:00Z"); // Mon 05 Oct 2026, 10:48 CEST
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const lukas = { id: "u-lukas", name: "Lukas Brenner" };
const adrian = { id: "u-adrian", name: "Adrian Koh" };
const mei = { id: "u-mei", name: "Mei Chen" };
const kevin = { id: "u-kevin", name: "Kevin Lim" };

const none: ClockResult = { state: "not_required", text: "", dueAt: null, overdue: false };
const running = (dueAt: Date): ClockResult => ({ state: "running", text: "", dueAt, overdue: dueAt < NOW });

function clocks(over: Partial<ComputedClocks> = {}): ComputedClocks {
  return { acknowledge: none, notify: none, compliance: null, ...over };
}

/** A customer issue (Revolut), owner Kevin, communicator Adrian, Compliance Mei, in progress, notification outstanding. */
function issue(over: Partial<RoleActionIssue> = {}): RoleActionIssue {
  return {
    issueId: "i1",
    number: 1046,
    status: "IN_PROGRESS",
    severity: "SEV1",
    entityName: "Revolut Ltd",
    isPartnerIssue: false,
    owner: kevin,
    communicator: adrian,
    complianceAssessor: mei,
    contributorIds: [lukas.id],
    clocksStartAt: at(-120),
    acknowledgedAt: at(-100),
    acknowledgedByName: "Kevin Lim",
    notifyRequired: true,
    notifiedAt: null,
    notifiedByName: null,
    complianceFlaggedAt: at(-110),
    complianceClosedAt: null,
    complianceVisibleFrom: null,
    firstAssessment: null,
    inheritedFrom: null,
    clocks: clocks({ notify: running(at(-5)), compliance: running(at(58)) }),
    ...over,
  };
}

describe("roleActionsFor(): the owner", () => {
  it("Acknowledge while New, with the acknowledge clock's deadline", () => {
    const i = issue({ status: "NEW", acknowledgedAt: null, acknowledgedByName: null, notifyRequired: false, complianceFlaggedAt: null, clocks: clocks({ acknowledge: running(at(12)) }) });
    const v = roleActionsFor(i, kevin.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "acknowledge", role: "Owner", label: "Acknowledge ISS-1046", dueAt: at(12), state: "open" });
    expect(v.waitingOn).toBeNull();
  });

  it("Investigate with no deadline once acknowledged; Acknowledge is done, with who and when", () => {
    const i = issue({ notifyRequired: false, complianceFlaggedAt: null, clocks: clocks() });
    const v = roleActionsFor(i, kevin.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "investigate", label: "Investigate and resolve ISS-1046", shortLabel: "Investigate", dueAt: null });
    expect(v.done).toHaveLength(1);
    expect(v.done[0]).toMatchObject({ key: "acknowledge", state: "done", done: { label: "Acknowledged", byName: "Kevin Lim", at: at(-100) } });
  });

  it("a partner issue's owner investigates with the partner and resolves", () => {
    const i = issue({ isPartnerIssue: true, entityName: "Lloyds Bank plc", communicator: kevin, notifyRequired: false, complianceFlaggedAt: null, clocks: clocks() });
    const actions = allRoleActions(i, NOW);
    expect(actions.find((a) => a.key === "investigate")?.label).toBe("Investigate with Lloyds Bank plc and resolve");
  });

  it("nothing for the owner on a Resolved issue", () => {
    const i = issue({ status: "RESOLVED", notifyRequired: false, complianceFlaggedAt: null, clocks: clocks() });
    expect(roleActionsFor(i, kevin.id, NOW).mine).toHaveLength(0);
  });
});

describe("roleActionsFor(): the communicator", () => {
  it("Notify the customer, with the notify clock's deadline", () => {
    const v = roleActionsFor(issue(), adrian.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "notify", role: "Communicator", label: "Notify Revolut Ltd", dueAt: at(-5) });
  });

  it("once notified the action is done and the communicator waits", () => {
    const i = issue({ notifiedAt: at(-3), notifiedByName: "Adrian Koh", complianceFlaggedAt: null, clocks: clocks() });
    const v = roleActionsFor(i, adrian.id, NOW);
    expect(v.mine).toHaveLength(0);
    expect(v.done.find((a) => a.key === "notify")?.done).toMatchObject({ label: "Customer notified", byName: "Adrian Koh", since: "Corvane became aware" });
    expect(v.waitingOn).toMatchObject({ key: "investigate", role: "Owner", person: kevin });
  });

  it("Confirm resolution with the customer once Resolved, no deadline", () => {
    const i = issue({ status: "RESOLVED", notifiedAt: at(-30), notifyRequired: true, complianceFlaggedAt: null, clocks: clocks() });
    const v = roleActionsFor(i, adrian.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "close", label: "Confirm resolution with the customer", dueAt: null });
  });

  it("no Notify when the severity needs none", () => {
    const i = issue({ notifyRequired: false, complianceFlaggedAt: null, clocks: clocks() });
    expect(allRoleActions(i, NOW).some((a) => a.key === "notify")).toBe(false);
  });
});

describe("roleActionsFor(): compliance", () => {
  it("Assess for Compliance for the assigned assessor, with the 1 h clock", () => {
    const v = roleActionsFor(issue(), mei.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "assess", role: "Compliance", label: "Assess for Compliance", dueAt: at(58) });
  });

  it("done after the first assessment, with who and when", () => {
    const i = issue({ firstAssessment: { at: at(-2), byName: "Mei Chen" }, clocks: clocks({ notify: running(at(-5)) }) });
    const v = roleActionsFor(i, mei.id, NOW);
    expect(v.mine).toHaveLength(0);
    expect(v.done.find((a) => a.key === "assess")?.done).toMatchObject({ label: "Assessed for Compliance", byName: "Mei Chen" });
  });

  it("hidden until the issue is visible to Compliance", () => {
    const i = issue({ complianceVisibleFrom: at(30) });
    expect(allRoleActions(i, NOW).some((a) => a.key === "assess")).toBe(false);
  });
});

describe("roleActionsFor(): a contributor holds no action and waits on the most urgent one", () => {
  it("waits on the person with the earliest deadline", () => {
    const v = roleActionsFor(issue(), lukas.id, NOW);
    expect(v.mine).toHaveLength(0);
    expect(v.waitingOn).toMatchObject({ key: "notify", person: adrian }); // overdue 5 min beats Mei's 58 min and Kevin's no deadline
    expect(v.open.map((a) => a.key)).toEqual(["notify", "assess", "investigate"]);
  });
});

describe("roleActionsFor(): a linked issue", () => {
  const linked = (parentAcked: boolean) =>
    issue({
      owner: lukas,
      communicator: adrian,
      acknowledgedAt: null,
      acknowledgedByName: null,
      complianceFlaggedAt: null,
      inheritedFrom: { id: "p1", number: 1045, entityName: "Lloyds Bank plc", acknowledgedAt: parentAcked ? at(-27) : null, acknowledgedByName: parentAcked ? "Lukas Brenner" : null },
      clocks: clocks({ notify: running(at(-5)) }),
    });

  it("parent not acknowledged: the owner's open action is to acknowledge on the parent", () => {
    const v = roleActionsFor(linked(false), lukas.id, NOW);
    expect(v.mine.map((a) => a.key)).toEqual(["acknowledge_on_parent", "investigate"]);
    expect(v.mine[0]).toMatchObject({ label: "Acknowledge on ISS-1045", via: { id: "p1", number: 1045 } });
  });

  it("parent acknowledged: done via the parent, and investigate points at the parent", () => {
    const v = roleActionsFor(linked(true), lukas.id, NOW);
    expect(v.done).toHaveLength(1);
    expect(v.done[0].done).toMatchObject({ label: "Acknowledged via ISS-1045", byName: "Lukas Brenner", at: at(-27) });
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "investigate", label: "Investigate with Lloyds Bank plc and resolve on ISS-1045", via: { id: "p1" } });
  });
});

describe("roleActionsFor(): waiting rows", () => {
  it("a person with a role and nothing to do waits on the most urgent action, and others excludes their own", () => {
    const i = issue({ notifiedAt: at(-3), clocks: clocks({ compliance: running(at(58)) }) });
    const v = roleActionsFor(i, adrian.id, NOW);
    expect(v.mine).toHaveLength(0);
    expect(v.waitingOn).toMatchObject({ key: "assess", person: mei }); // 58 min before Kevin's no deadline
    expect(v.mostUrgent).toBe(v.waitingOn);
  });

  it("an issue with nothing open has no waitingOn and no mostUrgent", () => {
    const i = issue({ status: "RESOLVED", notifiedAt: at(-3), complianceFlaggedAt: null, clocks: clocks(), communicator: null, owner: null, complianceAssessor: null });
    const v = roleActionsFor(i, lukas.id, NOW);
    expect(v.open).toHaveLength(0);
    expect(v.waitingOn).toBeNull();
    expect(v.mostUrgent).toBeNull();
  });
});

describe("compareHomeRows(): own actions first, then deadline, then severity, then the older issue", () => {
  const row = (over: Partial<HomeSortKey>): HomeSortKey => ({ hasAction: true, dueAt: null, severity: "SEV1", awareAt: at(-600), number: 1000, ...over });
  const order = (rows: HomeSortKey[]) => [...rows].sort(compareHomeRows).map((r) => r.number);

  it("the design example: ISS-1046 overdue, ISS-1053 in 7 h, then ISS-1038 waiting", () => {
    expect(
      order([
        row({ number: 1038, hasAction: false, severity: "SEV2" }),
        row({ number: 1053, dueAt: at(425) }),
        row({ number: 1046, dueAt: at(-5) }),
      ]),
    ).toEqual([1046, 1053, 1038]);
  });

  it("an action without a deadline comes after those with one, but before any waiting row", () => {
    expect(order([row({ number: 3, hasAction: false }), row({ number: 2, dueAt: null }), row({ number: 1, dueAt: at(900) })])).toEqual([1, 2, 3]);
  });

  it("same deadline: SEV1 before SEV2 before SEV3", () => {
    const d = at(30);
    expect(order([row({ number: 3, dueAt: d, severity: "SEV3" }), row({ number: 1, dueAt: d, severity: "SEV1" }), row({ number: 2, dueAt: d, severity: "SEV2" })])).toEqual([1, 2, 3]);
  });

  it("same deadline and severity: the older issue first, then the lower number", () => {
    const d = at(30);
    expect(order([row({ number: 5, dueAt: d, awareAt: at(-10) }), row({ number: 6, dueAt: d, awareAt: at(-500) }), row({ number: 4, dueAt: d, awareAt: at(-10) })])).toEqual([6, 4, 5]);
  });

  it("waiting rows sort among themselves by severity, then older", () => {
    expect(
      order([
        row({ number: 2, hasAction: false, severity: "SEV2" }),
        row({ number: 1, hasAction: false, severity: "SEV1", awareAt: at(-5) }),
        row({ number: 3, hasAction: false, severity: "SEV1", awareAt: at(-50) }),
      ]),
    ).toEqual([3, 1, 2]);
  });
});

describe("done actions carry their on-time / late evidence from the existing clocks", () => {
  const START = at(-200);
  // The real clock functions, so this checks the wiring to the existing target logic and not a restated number.
  const real = (over: Partial<import("@/server/derived/issue-clocks").IssueClockFields>) =>
    computeClocks(
      {
        severity: "SEV1", status: "IN_PROGRESS", severityCapLabel: null, clocksStartAt: START, ackStartAt: START, acknowledgedAt: null,
        notifyRequired: true, notifyStartAt: START, notifyTargetHours: 2, notifyDefaultTarget: false, notifyTargetBusinessMins: null, notifiedAt: null,
        complianceFlaggedAt: null, complianceClockStartAt: null, firstAssessmentAt: null, ...over,
      },
      { ownerCalendar: null, communicatorCalendar: null, viewerZone: "Europe/Amsterdam" },
      NOW,
    );

  it("acknowledged 9 min after Corvane became aware, target 15 min: on time", () => {
    const ackAt = new Date(START.getTime() + 9 * 60_000);
    const i = issue({ acknowledgedAt: ackAt, clocks: real({ acknowledgedAt: ackAt }), notifyRequired: false, complianceFlaggedAt: null });
    const done = allRoleActions(i, NOW).find((a) => a.key === "acknowledge")!.done!;
    expect(done.since).toBe("Corvane became aware");
    expect(done.timing).toEqual({ elapsedMinutes: 9, targetText: "15 min", lateMinutes: null });
  });

  it("notified 53 min after, target 2 h: on time; 150 min after: late by 30 min", () => {
    const onTime = new Date(START.getTime() + 53 * 60_000);
    const late = new Date(START.getTime() + 150 * 60_000);
    const mk = (notifiedAt: Date) => issue({ notifiedAt, notifiedByName: "Kevin Lim", clocks: real({ notifiedAt }), complianceFlaggedAt: null });
    expect(allRoleActions(mk(onTime), NOW).find((a) => a.key === "notify")!.done!.timing).toEqual({ elapsedMinutes: 53, targetText: "2 h", lateMinutes: null });
    expect(allRoleActions(mk(late), NOW).find((a) => a.key === "notify")!.done!.timing).toEqual({ elapsedMinutes: 150, targetText: "2 h", lateMinutes: 30 });
  });

  it("assessed after the flag: target 1 h", () => {
    const flagged = at(-100);
    const assessedAt = new Date(flagged.getTime() + 44 * 60_000);
    const i = issue({
      firstAssessment: { at: assessedAt, byName: "Mei Chen" },
      clocks: real({ complianceFlaggedAt: flagged, complianceClockStartAt: flagged, firstAssessmentAt: assessedAt }),
    });
    const done = allRoleActions(i, NOW).find((a) => a.key === "assess")!.done!;
    expect(done.since).toBe("the flag");
    expect(done.timing).toEqual({ elapsedMinutes: 44, targetText: "1 h", lateMinutes: null });
  });

  it("a linked issue's acknowledgement via its parent has no timing of its own", () => {
    const i = issue({ inheritedFrom: { id: "p1", number: 1045, entityName: "Lloyds Bank plc", acknowledgedAt: at(-27), acknowledgedByName: "Lukas Brenner" } });
    expect(allRoleActions(i, NOW).find((a) => a.key === "acknowledge_on_parent")!.done!.timing).toBeUndefined();
  });
});

describe("the root cause report task (M27, M20 AC14 Owner row)", () => {
  const DUE = at(14 * 24 * 60);
  const task = (over: Partial<NonNullable<RoleActionIssue["reportTask"]>> = {}) => ({ dueAt: DUE, sentAt: null, sentToName: null, sentByName: null, sentByTeam: null, reportUrl: null, approvedAt: null, approvedByName: null, approvedByTeam: null, ...over });
  const DRAFT = { draftSharedAt: at(-8), draftSharedByName: "Kevin Lim" };
  const APPROVED = { ...DRAFT, approvedAt: at(-6), approvedByName: "Mei Chen", approvedByTeam: "COMPLIANCE" as const };
  const resolvedIssue = (over: Partial<RoleActionIssue> = {}) =>
    issue({ status: "RESOLVED", notifyRequired: false, complianceFlaggedAt: null, clocks: clocks(), reportTask: task(), reportReviewer: mei, resolved: { at: at(-10), byId: kevin.id, byName: "Kevin Lim" }, ...over });

  it("the owner prepares first ('Prepare root cause report for <customer>', by the contract deadline, as a date); Approve and Send wait, their deadline visible", () => {
    const v = roleActionsFor(resolvedIssue(), kevin.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "prepare_report", role: "Owner", label: "Prepare root cause report for Revolut Ltd", dueAt: DUE, dateOnly: true, state: "open" });
    const review = v.blocked.find((a) => a.key === "review_report")!;
    expect(review).toMatchObject({ role: "Compliance", person: mei, state: "blocked", startsWhen: "Starts when Kevin Lim shares the draft", dueAt: null, plannedText: "3 business days" });
    const send = v.blocked.find((a) => a.key === "send_report")!;
    expect(send).toMatchObject({ role: "Owner", label: "Send approved report to Revolut Ltd", state: "blocked", startsWhen: "Starts when Mei Chen approves", dueAt: DUE, dateOnly: true });
    expect(roleActionsFor(resolvedIssue(), mei.id, NOW).mine).toHaveLength(0);
  });

  it("once the draft is shared, Compliance approves (open, by the report's deadline); the owner has nothing of his own on the report", () => {
    const v = roleActionsFor(resolvedIssue({ reportTask: task(DRAFT) }), kevin.id, NOW);
    expect(v.mine).toHaveLength(0);
    expect(v.done.find((a) => a.key === "prepare_report")!.done).toMatchObject({ label: "Draft shared", byName: "Kevin Lim" });
    expect(v.open.find((a) => a.key === "review_report")).toMatchObject({ role: "Compliance", person: mei, label: "Approve root cause report", dueAt: addBusinessMinutes(DRAFT.draftSharedAt, 1620, teamCalendar("COMPLIANCE")), dateOnly: true });
    expect(roleActionsFor(resolvedIssue({ reportTask: task(DRAFT) }), mei.id, NOW).mine.map((a) => a.key)).toEqual(["review_report"]);
  });

  it("Approve is due 3 business days after the draft, but never later than the report's own date", () => {
    const soon = at(24 * 60); // the report is due in a day: sooner than 3 business days
    const v = roleActionsFor(resolvedIssue({ reportTask: task({ ...DRAFT, dueAt: soon }) }), mei.id, NOW);
    expect(v.open.find((a) => a.key === "review_report")!.dueAt).toEqual(soon);
  });

  it("once approved, the owner has 'Send approved report to <customer>' with the task's deadline, as a date", () => {
    const v = roleActionsFor(resolvedIssue({ reportTask: task(APPROVED) }), kevin.id, NOW);
    expect(v.mine).toHaveLength(1);
    expect(v.mine[0]).toMatchObject({ key: "send_report", role: "Owner", label: "Send approved report to Revolut Ltd", dueAt: DUE, dateOnly: true, state: "open" });
    expect(v.open.some((a) => a.key === "review_report")).toBe(false);
  });

  it("stays open on a Closed issue until the report is recorded (once approved)", () => {
    const v = roleActionsFor(resolvedIssue({ status: "CLOSED", reportTask: task(APPROVED) }), kevin.id, NOW);
    expect(v.mine.map((a) => a.key)).toEqual(["send_report"]);
  });

  it("the communicator waits on Compliance's approval (and on nothing else once notified)", () => {
    const v = roleActionsFor(resolvedIssue({ notifyRequired: true, notifiedAt: at(-60) }), adrian.id, NOW);
    expect(v.mine.map((a) => a.key)).toEqual(["close"]); // Resolved: Confirm resolution with the customer is Adrian's own
    expect(v.others.map((a) => a.key)).toEqual(["prepare_report"]); // the draft first: the owner's step, which Adrian waits on
    expect(v.waitingOn).toBeNull();
    const shared = roleActionsFor(resolvedIssue({ notifyRequired: true, notifiedAt: at(-60), reportTask: task(DRAFT) }), adrian.id, NOW);
    expect(shared.others.map((a) => a.key)).toEqual(["review_report"]);
  });

  it("once recorded: a Done line with the recipient, the sender's team and the link", () => {
    const sent = at(-2);
    const v = roleActionsFor(
      resolvedIssue({ reportTask: task({ ...APPROVED, sentAt: sent, sentToName: "Priya Nair", sentByName: "Kevin Lim", sentByTeam: "OPS", reportUrl: "https://docs.corvane-internal.example/r/1" }) }),
      kevin.id,
      NOW,
    );
    expect(v.open.some((a) => a.key === "send_report" || a.key === "review_report")).toBe(false);
    const done = v.done.find((a) => a.key === "send_report")!.done!;
    expect(done).toMatchObject({ label: "Root cause report sent", byName: "Kevin Lim", at: sent, report: { to: "Priya Nair", team: "OPS", url: "https://docs.corvane-internal.example/r/1" } });
  });

  it("'Resolved by <owner>' is a Done line, in time order with the others; the approval is its own Done line, by whoever approved", () => {
    const v = roleActionsFor(resolvedIssue({ reportTask: task({ ...APPROVED, sentAt: at(-2), sentToName: "Priya Nair", sentByName: "Kevin Lim", sentByTeam: "OPS" }) }), kevin.id, NOW);
    expect(v.done.map((a) => a.key)).toEqual(["acknowledge", "resolve", "prepare_report", "review_report", "send_report"]);
    expect(v.done.find((a) => a.key === "resolve")!.done).toMatchObject({ label: "Resolved", byName: "Kevin Lim", at: at(-10) });
    expect(v.done.find((a) => a.key === "review_report")!.done).toMatchObject({ label: "Root cause report approved", byName: "Mei Chen", byTeam: "COMPLIANCE" });
  });

  it("no review row when there is no Compliance person, or when they are the owner", () => {
    expect(allRoleActions(resolvedIssue({ reportReviewer: null }), NOW).some((a) => a.key === "review_report")).toBe(false);
    expect(allRoleActions(resolvedIssue({ reportReviewer: kevin }), NOW).some((a) => a.key === "review_report")).toBe(false);
  });

  it("no task, no report rows", () => {
    expect(allRoleActions(resolvedIssue({ reportTask: null }), NOW).some((a) => a.key === "send_report" || a.key === "review_report")).toBe(false);
  });
});
