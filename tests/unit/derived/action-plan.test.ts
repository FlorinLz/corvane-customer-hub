import { describe, expect, it } from "vitest";

import { roleActionsFor, type RoleActionIssue } from "@/server/derived/role-actions";
import { computeClocks, type IssueClockFields } from "@/server/derived/issue-clocks";

/**
 * The Action plan: the process order, the same for every viewer (acknowledge, notify, assess, investigate and resolve, confirm the
 * resolution, prepare, approve and send the report), waiting steps in their own place, the Done lines apart; and "Your next action", which stays
 * by deadline. A linked Sev-1 issue at a UK FCA customer, the shape of ISS-1046: Adrian (communicator), Lukas (owner), Mei (Compliance).
 */
const NOW = new Date("2026-10-05T08:48:00Z"); // Mon 05 Oct 2026, 10:48 CEST
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const lukas = { id: "u-lukas", name: "Lukas Brenner" };
const adrian = { id: "u-adrian", name: "Adrian Koh" };
const mei = { id: "u-mei", name: "Mei Chen" };
const kevin = { id: "u-kevin", name: "Kevin Lim" };
const emma = { id: "u-emma", name: "Emma Wilson" };

const awareAt = at(-125); // 08:43 CEST

function clocksFor(over: Partial<IssueClockFields> = {}) {
  return computeClocks(
    {
      severity: "SEV1", status: "IN_PROGRESS", severityCapLabel: null, clocksStartAt: awareAt, ackStartAt: null, acknowledgedAt: null,
      notifyRequired: true, notifyStartAt: awareAt, notifyTargetHours: 2, notifyDefaultTarget: false, notifyTargetBusinessMins: null, notifiedAt: null,
      complianceFlaggedAt: awareAt, complianceClockStartAt: awareAt, firstAssessmentAt: null, ...over,
    },
    { ownerCalendar: null, communicatorCalendar: null, viewerZone: "Europe/Amsterdam" },
    NOW,
  );
}

function linked(over: Partial<RoleActionIssue> = {}): RoleActionIssue {
  return {
    issueId: "i1046", number: 1046, status: "IN_PROGRESS", severity: "SEV1", entityName: "Revolut Ltd", isPartnerIssue: false,
    owner: lukas, communicator: adrian, complianceAssessor: mei, contributorIds: [], clocksStartAt: awareAt,
    acknowledgedAt: null, acknowledgedByName: null, notifyRequired: true, notifiedAt: null, notifiedByName: null,
    notifyTargetHours: 2, notifyDefaultTarget: false, notifyTargetBusinessMins: null, communicatorRule: "CUSTOMER_OWNER", handoverAt: null,
    complianceFlaggedAt: awareAt, complianceClosedAt: null, complianceVisibleFrom: null, firstAssessment: null,
    reportReviewer: mei, planned: true, reportPlan: { days: 14 },
    inheritedFrom: { id: "i1045", number: 1045, entityName: "Lloyds Bank plc", acknowledgedAt: at(-27), acknowledgedByName: "Lukas Brenner" },
    clocks: clocksFor(),
    ...over,
  };
}

const keys = (list: { key: string }[]) => list.map((a) => a.key);

describe("Action plan: the order", () => {
  it("before resolution: the process order, open and waiting steps together; the deadline rides on each row", () => {
    const v = roleActionsFor(linked(), adrian.id, NOW);
    // Now: Mei's Assess (flag 08:43 + 1 h: 09:43, overdue), Adrian's Notify (2 h from aware at 08:43 is 10:43, overdue 5 min later), Lukas's Investigate (no deadline).
    expect(keys(v.plan)).toEqual(["notify", "assess", "investigate", "close", "prepare_report", "review_report", "send_report"]);
    expect(keys(v.open)).toEqual(["assess", "notify", "investigate"]); // by deadline: what "Your next action" and Home read
    expect(keys(v.blocked)).toEqual(["close", "prepare_report", "review_report", "send_report"]);
    expect(v.plan.find((a) => a.key === "assess")!.dueAt).not.toBeNull(); // the deadline stays on the row
    expect(v.plan.find((a) => a.key === "notify")!.dueAt).not.toBeNull();
    expect(v.plan.filter((a) => a.state === "blocked").every((a) => a.startsWhen === "Starts when ISS-1045 is resolved")).toBe(true);
  });

  it("the same order for every viewer; the viewer's own rows are only marked, not moved", () => {
    const orders = [adrian, lukas, mei, kevin].map((u) => keys(roleActionsFor(linked(), u.id, NOW).plan));
    for (const o of orders) expect(o).toEqual(["notify", "assess", "investigate", "close", "prepare_report", "review_report", "send_report"]);
  });

  it("a waiting step of the viewer's keeps its process position (it does not move up or down)", () => {
    const v = roleActionsFor(linked(), adrian.id, NOW);
    const close = v.plan[3];
    expect(close.key).toBe("close");
    expect(close.person.id).toBe(adrian.id);
    expect(close.state).toBe("blocked");
  });
});

describe("Linked issue: the steps that mirror the partner issue's steps show its clocks", () => {
  const unacked = (ackDueAt: Date | null) => ({ id: "i1045", number: 1045, entityName: "Lloyds Bank plc", acknowledgedAt: null, acknowledgedByName: null, ackDueAt });

  it("'Acknowledge on ISS-n' carries the partner issue's own acknowledge deadline, and keeps the Acknowledge position, for Mei Chen and Adrian Koh alike", () => {
    const due = at(-30); // overdue now, between Mei's Assess (-65 min) and Adrian's Notify (-5 min)
    const issue = linked({ inheritedFrom: unacked(due) });
    for (const u of [mei, adrian, lukas]) {
      const v = roleActionsFor(issue, u.id, NOW);
      const ack = v.plan.find((a) => a.key === "acknowledge_on_parent")!;
      expect(ack).toMatchObject({ state: "open", label: "Acknowledge on ISS-1045", dueAt: due, person: lukas });
      expect(ack.via).toEqual({ id: "i1045", number: 1045 });
      // In process order, whoever owns the step: the partner acknowledge sits where Acknowledge sits, first, then Notify and Assess.
      expect(keys(v.plan).slice(0, 3)).toEqual(["acknowledge_on_parent", "notify", "assess"]);
    }
    expect(roleActionsFor(issue, lukas.id, NOW).next.mine?.key).toBe("acknowledge_on_parent"); // the partner owner's next action
  });

  it("a partner step with no clock keeps 'No deadline': Investigate on the partner issue", () => {
    const v = roleActionsFor(linked({ inheritedFrom: unacked(at(-5)), status: "IN_PROGRESS" }), adrian.id, NOW);
    expect(v.plan.find((a) => a.key === "investigate")!.dueAt).toBeNull();
    expect(roleActionsFor(linked({ inheritedFrom: unacked(null) }), adrian.id, NOW).plan.find((a) => a.key === "acknowledge_on_parent")!.dueAt).toBeNull();
  });

  it("once the partner issue is acknowledged: the Done line 'Acknowledged via ISS-n by <name>' and no open step", () => {
    const v = roleActionsFor(linked(), mei.id, NOW);
    expect(v.plan.some((a) => a.key === "acknowledge_on_parent")).toBe(false);
    expect(v.done.find((a) => a.key === "acknowledge_on_parent")!.done).toMatchObject({ label: "Acknowledged via ISS-1045", byName: "Lukas Brenner" });
  });
});

describe("Action plan: which waiting steps exist", () => {
  it("none on a partner issue, none when no report task will exist (not Sev-1, or the customer is not regulated), Confirm resolution always while open", () => {
    const partner = roleActionsFor(linked({ isPartnerIssue: true, inheritedFrom: null, communicator: lukas, reportPlan: null, notifyRequired: false, complianceFlaggedAt: null, clocks: clocksFor({ notifyRequired: false, complianceFlaggedAt: null }) }), lukas.id, NOW);
    expect(keys(partner.blocked)).toEqual(["close"]);
    expect(partner.blocked[0].startsWhen).toBe("Starts when ISS-1046 is resolved");

    const unregulated = roleActionsFor(linked({ reportPlan: null }), adrian.id, NOW);
    expect(keys(unregulated.blocked)).toEqual(["close"]);
  });

  it("an issue nobody has acknowledged yet: the owner's Investigate waits for the acknowledgement", () => {
    const standalone = linked({ inheritedFrom: null, status: "NEW", clocks: clocksFor({ ackStartAt: awareAt }) });
    const v = roleActionsFor(standalone, kevin.id, NOW);
    const investigate = v.blocked.find((a) => a.key === "investigate")!;
    expect(investigate.startsWhen).toBe("Starts when ISS-1046 is acknowledged");
    expect(keys(v.mine)).toEqual([]); // Kevin has no role here; the Acknowledge is Lukas's (the owner)
    expect(keys(roleActionsFor(standalone, lukas.id, NOW).mine)).toContain("acknowledge");
  });

  it("none once the issue is resolved: the steps are real (or done) by then", () => {
    const v = roleActionsFor(linked({ status: "RESOLVED", reportTask: { dueAt: at(14 * 24 * 60), sentAt: null, sentToName: null, sentByName: null, sentByTeam: null, reportUrl: null, approvedAt: at(-5), approvedByName: "Mei Chen", approvedByTeam: "COMPLIANCE" } }), adrian.id, NOW);
    expect(v.blocked).toEqual([]);
  });
});

describe("Confirm resolution step wording", () => {
  it("the partner issue's communicator confirms with the partner; a customer issue confirms with the customer (planned and open)", () => {
    const partner = linked({ isPartnerIssue: true, inheritedFrom: null, communicator: lukas, reportPlan: null, notifyRequired: false, complianceFlaggedAt: null, clocks: clocksFor({ notifyRequired: false, complianceFlaggedAt: null }) });
    const planned = roleActionsFor(partner, lukas.id, NOW).blocked.find((a) => a.key === "close")!;
    expect(planned.label).toBe("Confirm resolution with the partner");
    expect(planned.shortLabel).toBe("Confirm resolution with the partner");
    const open = roleActionsFor({ ...partner, status: "RESOLVED" }, lukas.id, NOW).next.mine!;
    expect(open.key).toBe("close");
    expect(open.label).toBe("Confirm resolution with the partner");

    expect(roleActionsFor(linked(), adrian.id, NOW).blocked.find((a) => a.key === "close")!.label).toBe("Confirm resolution with the customer");
    expect(roleActionsFor(linked({ status: "RESOLVED", reportPlan: null, notifiedAt: at(-60), firstAssessment: { at: at(-70), byName: "Mei Chen" }, clocks: clocksFor({ notifiedAt: at(-60) }) }), adrian.id, NOW).next.mine!.label).toBe("Confirm resolution with the customer");
  });
});

describe("Action plan: sub-lines", () => {
  it("each step carries its line", () => {
    const v = roleActionsFor(linked(), adrian.id, NOW);
    const sub = (key: string) => v.plan.find((a) => a.key === key)?.subLine;
    expect(sub("notify")).toBe("Required by the customer contract: notify the customer within 2 h");
    expect(sub("assess")).toBe("1 h after the Compliance flag");
    expect(sub("prepare_report")).toBe("Required by the customer contract: 14 days after resolution");
    expect(sub("review_report")).toBe("Approve before the report is sent");
    expect(sub("close")).toBe("After resolution");
    expect(v.plan.find((a) => a.key === "prepare_report")!.plannedDays).toBe(14);
    expect(v.plan.find((a) => a.key === "send_report")!.plannedDays).toBe(14);
  });

  it("the contract names no days: the report step says it falls back to 10 business days; Sev-1 with no contract hours reads the default; the contract is never attributed to the regulator", () => {
    const v = roleActionsFor(linked({ reportPlan: { days: null }, notifyTargetHours: 2, notifyDefaultTarget: true }), adrian.id, NOW);
    expect(v.plan.find((a) => a.key === "prepare_report")!.subLine).toBe("The contract has no report period: 10 business days after resolution");
    expect(v.plan.find((a) => a.key === "notify")!.subLine).toBe("2 h after Corvane aware at");
    for (const a of v.plan) expect(a.subLine ?? "").not.toMatch(/Required by (UK FCA|EU DORA)/);
  });

  it("an unacknowledged issue's Acknowledge step reads its target; the on-call person's Notify says until when", () => {
    const v = roleActionsFor(linked({ inheritedFrom: null, status: "NEW", owner: kevin, communicator: kevin, communicatorRule: "ISSUE_OWNER_UNTIL_HANDOVER", handoverAt: at(5 * 60) }), kevin.id, NOW);
    expect(v.plan.find((a) => a.key === "acknowledge")!.subLine).toBe("15 min after Corvane aware at");
    expect(v.plan.find((a) => a.key === "notify")!.onCallUntil).toEqual(at(5 * 60));
  });
});

describe("Your next action", () => {
  it("is the viewer's most urgent open step", () => {
    const v = roleActionsFor(linked(), adrian.id, NOW);
    expect(v.next.mine?.key).toBe("notify");
    expect(v.next.other).toBeNull();
  });

  it("with nothing of the viewer's: the next step of somebody else, by deadline", () => {
    const v = roleActionsFor(linked({ communicator: adrian }), kevin.id, NOW); // Kevin has no role here
    expect(v.next.mine).toBeNull();
    expect(v.next.other?.key).toBe("assess"); // Mei's, the earliest deadline
  });

  it("a waiting step never counts as a next action", () => {
    const resolvedNoTask = linked({ status: "RESOLVED", notifiedAt: at(-60), firstAssessment: { at: at(-70), byName: "Mei Chen" }, reportPlan: null, clocks: clocksFor({ notifiedAt: at(-60) }) });
    const v = roleActionsFor(resolvedNoTask, adrian.id, NOW);
    expect(v.next.mine?.key).toBe("close");
  });

  it("nothing open anywhere: no next step at all", () => {
    const v = roleActionsFor(linked({ status: "CLOSED", communicator: null, owner: null, complianceAssessor: null, reportReviewer: null, reportPlan: null, planned: true }), adrian.id, NOW);
    expect(v.next).toEqual({ mine: null, other: null });
  });
});

describe("Root cause report steps (M27): prepare, approve, send", () => {
  const task = (over: Partial<NonNullable<RoleActionIssue["reportTask"]>> = {}) => ({
    reportDays: 14, dueAt: at(14 * 24 * 60), sentAt: null, sentToName: null, sentByName: null, sentByTeam: null, reportUrl: null,
    approvedAt: null, approvedByName: null, approvedByTeam: null, draftSharedAt: null, draftSharedByName: null, changesRequest: null, ...over,
  });
  const DRAFT = { draftSharedAt: at(-8), draftSharedByName: "Lukas Brenner" };
  const APPROVED = { ...DRAFT, approvedAt: at(-6), approvedByName: "Mei Chen", approvedByTeam: "COMPLIANCE" as const };
  const resolved = (over: Partial<RoleActionIssue> = {}) =>
    linked({ status: "RESOLVED", notifiedAt: at(-60), firstAssessment: { at: at(-70), byName: "Mei Chen" }, reportPlan: null, reportTask: task(), resolved: { at: at(-10), byId: lukas.id, byName: "Lukas Brenner", viaNumber: 1045 }, clocks: clocksFor({ notifiedAt: at(-60) }), ...over });

  it("right after resolution, every viewer sees the same order: Notify, Assess, Confirm resolution, Prepare, Approve, Send (the last two waiting)", () => {
    // Assessment and notification still open, as on ISS-1046 right after the resolution.
    const issue = resolved({ notifiedAt: null, firstAssessment: null, clocks: clocksFor() });
    for (const u of [lukas, adrian, mei]) {
      const v = roleActionsFor(issue, u.id, NOW);
      expect(keys(v.plan)).toEqual(["notify", "assess", "close", "prepare_report", "review_report", "send_report"]);
      expect(v.plan.map((a) => a.state)).toEqual(["open", "open", "open", "open", "blocked", "blocked"]);
    }
  });

  it("step 1, Prepare root cause report for <customer>: the owner's, open with the contract deadline as a date; Approve waits 'Starts when <owner> shares the draft', Send waits 'Starts when <Compliance person> approves'", () => {
    const v = roleActionsFor(resolved(), lukas.id, NOW);
    expect(v.plan.find((a) => a.key === "prepare_report")).toMatchObject({ state: "open", label: "Prepare root cause report for Revolut Ltd", dateOnly: true, dueAt: at(14 * 24 * 60), person: lukas, subLine: "Required by the customer contract: 14 days after resolution" });
    expect(v.next.mine?.key).toBe("prepare_report");
    const review = v.plan.find((a) => a.key === "review_report")!;
    expect(review).toMatchObject({ state: "blocked", label: "Approve root cause report", startsWhen: "Starts when Lukas Brenner shares the draft", person: mei, dueAt: at(14 * 24 * 60), dateOnly: true });
    expect(review.waitLabel).toBe("Approve the report");
    expect(v.plan.find((a) => a.key === "send_report")).toMatchObject({ state: "blocked", label: "Send approved report to Revolut Ltd", startsWhen: "Starts when Mei Chen approves", dueAt: at(14 * 24 * 60), dateOnly: true });
    expect(v.open.find((a) => a.key === "prepare_report")!.waitLabel).toBe("Share the draft");
  });

  it("step 2, the draft is shared: Prepare is Done ('Draft shared' by the owner), Approve is Mei's open step by the report's deadline, 'Approve before the report is sent, by <date>'; Send still waits; Close waits for neither", () => {
    const v = roleActionsFor(resolved({ reportTask: task(DRAFT) }), mei.id, NOW);
    expect(v.done.find((a) => a.key === "prepare_report")!.done).toMatchObject({ label: "Draft shared", byName: "Lukas Brenner", at: at(-8) });
    const review = v.plan.find((a) => a.key === "review_report")!;
    expect(review).toMatchObject({ state: "open", dateOnly: true, dueAt: at(14 * 24 * 60), subLine: "Approve before the report is sent", subLineBy: at(14 * 24 * 60) });
    expect(review.person.id).toBe(mei.id);
    expect(v.next.mine?.key).toBe("review_report");
    expect(v.plan.find((a) => a.key === "send_report")).toMatchObject({ state: "blocked", startsWhen: "Starts when Mei Chen approves" });
    expect(v.plan.find((a) => a.key === "close")).toMatchObject({ state: "open", person: adrian });
    // The owner now waits on Compliance.
    const lukasView = roleActionsFor(resolved({ reportTask: task(DRAFT) }), lukas.id, NOW);
    expect(lukasView.next.mine?.key).not.toBe("send_report");
    expect(lukasView.others.find((a) => a.key === "review_report")!.waitLabel).toBe("Approve the report");
  });

  it("Compliance asked for changes: Prepare is open again for the owner with the reason on the step, and Approve waits again", () => {
    const v = roleActionsFor(resolved({ reportTask: task({ changesRequest: { byName: "Mei Chen", reason: "The impact section is missing the customer count." } }) }), lukas.id, NOW);
    const prepare = v.plan.find((a) => a.key === "prepare_report")!;
    expect(prepare).toMatchObject({ state: "open", subLine: "Changes requested by Mei Chen: The impact section is missing the customer count." });
    expect(v.plan.find((a) => a.key === "review_report")).toMatchObject({ state: "blocked", startsWhen: "Starts when Lukas Brenner shares the draft" });
    expect(v.done.some((a) => a.key === "prepare_report")).toBe(false); // the refused draft is History, not a Done line
  });

  it("step 3, approved: a Done line naming who approved, and 'Send approved report to <customer>' is the owner's open step", () => {
    // Approved by another Compliance user (Kevin stands in): the Done line names him, the step stays assigned to Mei.
    const v = roleActionsFor(resolved({ reportTask: task({ ...APPROVED, approvedByName: "Kevin Lim" }) }), lukas.id, NOW);
    const done = v.done.find((a) => a.key === "review_report")!;
    expect(done.person.id).toBe(mei.id);
    expect(done.done).toMatchObject({ label: "Root cause report approved", byName: "Kevin Lim", byTeam: "COMPLIANCE", at: at(-6) });
    expect(keys(v.open)).toEqual(["send_report", "close"]);
    expect(v.next.mine).toMatchObject({ key: "send_report", label: "Send approved report to Revolut Ltd" });
  });

  it("no 'completed when <owner> recorded the report' line, ever: the three Done lines are each the person's own", () => {
    const sent = at(-2);
    const v = roleActionsFor(resolved({ reportTask: task({ ...APPROVED, sentAt: sent, sentToName: "Priya Nair", sentByName: "Lukas Brenner", sentByTeam: "NETWORK", reportUrl: "https://docs.corvane-internal.example/r/1" }) }), adrian.id, NOW);
    expect(keys(v.open)).toEqual(["close"]);
    expect(v.done.map((a) => a.key)).toEqual(expect.arrayContaining(["prepare_report", "review_report", "send_report"]));
    expect(v.done.find((a) => a.key === "prepare_report")!.done).toMatchObject({ byName: "Lukas Brenner" });
    expect(v.done.find((a) => a.key === "review_report")!.done).toMatchObject({ label: "Root cause report approved", byName: "Mei Chen", at: APPROVED.approvedAt });
    expect(JSON.stringify(v.done)).not.toContain("completed when");
    expect(v.done.find((a) => a.key === "send_report")!.done).toMatchObject({ label: "Root cause report sent", report: { to: "Priya Nair", url: "https://docs.corvane-internal.example/r/1" } });
  });

  it("the Done line of the resolution says it was resolved via the partner issue", () => {
    const v = roleActionsFor(resolved(), lukas.id, NOW);
    expect(v.done.find((a) => a.key === "resolve")!.done!.label).toBe("Resolved via ISS-1045");
    expect(v.done.find((a) => a.key === "acknowledge_on_parent")!.done!.label).toBe("Acknowledged via ISS-1045");
  });
});

describe("Process order on ISS-1042 and ISS-1046, the same for every viewer", () => {
  const PROCESS = ["acknowledge", "acknowledge_on_parent", "notify", "assess", "investigate", "close", "prepare_report", "review_report", "send_report"];
  const sorted = (list: string[]) => [...list].sort((a, b) => PROCESS.indexOf(a) - PROCESS.indexOf(b));
  const task = { reportDays: 14, dueAt: at(14 * 24 * 60), sentAt: null, sentToName: null, sentByName: null, sentByTeam: null, reportUrl: null, approvedAt: null, approvedByName: null, approvedByTeam: null, draftSharedAt: null, draftSharedByName: null, changesRequest: null };

  // ISS-1046, the linked Revolut issue, just after the cascade resolved it: Adrian (communicator), Lukas (owner), Mei (Compliance).
  const iss1046 = linked({ status: "RESOLVED", reportPlan: null, reportTask: task, resolved: { at: at(-10), byId: lukas.id, byName: "Lukas Brenner", viaNumber: 1045 } });
  // ISS-1042, MPS: Kevin owns it, Emma communicates, Mei assessed it; resolved, the report task open.
  const iss1042 = linked({
    number: 1042, issueId: "i1042", entityName: "Banca Monte dei Paschi di Siena S.p.A.", status: "RESOLVED", inheritedFrom: null, owner: kevin, communicator: emma, acknowledgedAt: at(-120), acknowledgedByName: "Kevin Lim",
    notifiedAt: at(-80), firstAssessment: { at: at(-70), byName: "Mei Chen" }, reportPlan: null, reportTask: task, resolved: { at: at(-10), byId: kevin.id, byName: "Kevin Lim", viaNumber: null },
    clocks: clocksFor({ status: "RESOLVED", acknowledgedAt: at(-120), notifiedAt: at(-80), firstAssessmentAt: at(-70) }),
  });

  it("ISS-1046: Kevin, Emma, Mei, Lukas and Adrian all see Notify, Assess, Confirm resolution, Prepare, Approve, Send", () => {
    const expected = ["notify", "assess", "close", "prepare_report", "review_report", "send_report"];
    for (const u of [kevin, emma, mei, lukas, adrian]) expect(keys(roleActionsFor({ ...iss1046, notifiedAt: null, firstAssessment: null, clocks: clocksFor() }, u.id, NOW).plan), u.name).toEqual(expected);
  });

  it("ISS-1042: Kevin, Emma, Mei, Lukas and Adrian all see Confirm resolution, then Prepare, Approve, Send; Investigate and the rest are Done lines", () => {
    const expected = ["close", "prepare_report", "review_report", "send_report"];
    for (const u of [kevin, emma, mei, lukas, adrian]) {
      const plan = keys(roleActionsFor(iss1042, u.id, NOW).plan);
      expect(plan, u.name).toEqual(expected);
      expect(plan, u.name).toEqual(sorted(plan));
    }
  });

  it("the report chain is never split: Confirm resolution comes before Prepare, Approve and Send, whatever the deadlines", () => {
    for (const issue of [iss1042, iss1046]) {
      const plan = keys(roleActionsFor(issue, mei.id, NOW).plan);
      expect(plan.indexOf("close")).toBeLessThan(plan.indexOf("prepare_report"));
      expect(plan.indexOf("prepare_report") + 1).toBe(plan.indexOf("review_report"));
      expect(plan.indexOf("review_report") + 1).toBe(plan.indexOf("send_report"));
    }
  });

  it("once the resolution is confirmed it is a Done line ('Resolution confirmed') and the report steps stay open", () => {
    const v = roleActionsFor({ ...iss1042, closure: { at: at(-3), byName: "Emma Wilson" } }, emma.id, NOW);
    expect(keys(v.plan)).toEqual(["prepare_report", "review_report", "send_report"]);
    expect(v.done.find((a) => a.key === "close")!.done).toMatchObject({ label: "Resolution confirmed", byName: "Emma Wilson", at: at(-3) });
    expect(v.next.mine).toBeNull(); // Emma has nothing left to do
  });
});
