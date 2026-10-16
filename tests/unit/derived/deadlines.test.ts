import { describe, expect, it } from "vitest";

import type { Calendar } from "@/lib/business-hours";
import { addTarget, computeDeadlines, deadlineTone, isSoon, type DeadlineFacts, type DeadlineKey } from "@/server/derived/deadlines";

const CAL: Calendar = { timeZone: "Europe/Amsterdam", start: "09:00", end: "18:00", weekdays: [1, 2, 3, 4, 5] };
const cals = { owner: CAL, communicator: CAL };
const at = (iso: string) => new Date(iso); // Europe/Amsterdam is +02:00 in October 2026
const MON_1005 = at("2026-10-05T10:05:00+02:00");
const MIN = 60_000;

const facts = (over: Partial<DeadlineFacts> = {}): DeadlineFacts => ({
  severity: "SEV1",
  status: "IN_PROGRESS",
  type: "SERVICE_UNAVAILABLE",
  isPartnerIssue: false,
  isLinkedChild: false,
  awareAt: at("2026-10-04T21:12:00+02:00"), // Sunday night
  notifyRequired: true,
  notifiedAt: at("2026-10-04T22:05:00+02:00"),
  lastUpdateAt: null,
  restoredAt: null,
  resolvedAt: null,
  closureConfirmedAt: null,
  repliedAt: null,
  waitingOnCustomerSince: null,
  pausedMinutes: 0,
  pausedBusinessMinutes: 0,
  factsHours: null,
  factsStartAt: null,
  factsSentAt: null,
  lastPartnerContactAt: null,
  ...over,
});

const get = (f: DeadlineFacts, key: DeadlineKey, now = MON_1005) => computeDeadlines(f, cals, now).find((d) => d.key === key);

describe("Restore service (owner)", () => {
  it("Sev-1: 4 h from aware at, 24/7, even across the night", () => {
    const d = get(facts(), "restore")!;
    expect(d.state).toBe("open");
    expect(d.dueAt).toEqual(at("2026-10-05T01:12:00+02:00"));
    expect(d.business).toBe(false);
    expect(d.targetMinutes).toBe(240);
    expect(d.role).toBe("Owner");
  });

  it("Sev-2: 1 business day, counted in the owner's business hours", () => {
    const d = get(facts({ severity: "SEV2", awareAt: at("2026-10-05T09:30:00+02:00") }), "restore")!;
    expect(d.dueAt).toEqual(at("2026-10-06T09:30:00+02:00"));
    expect(d.business).toBe(true);
    // Reported on Friday afternoon: the clock runs on Monday.
    const friday = get(facts({ severity: "SEV2", awareAt: at("2026-10-09T17:00:00+02:00") }), "restore")!;
    expect(friday.dueAt).toEqual(at("2026-10-12T17:00:00+02:00"));
  });

  it("Sev-3, Sev-4, BILLING and linked issues have none", () => {
    expect(get(facts({ severity: "SEV3" }), "restore")).toBeUndefined();
    expect(get(facts({ severity: "SEV4" }), "restore")).toBeUndefined();
    expect(get(facts({ severity: "SEV2", type: "BILLING" }), "restore")).toBeUndefined();
    expect(get(facts({ isLinkedChild: true }), "restore")).toBeUndefined();
    // Only an outage has a service to restore.
    expect(get(facts({ severity: "SEV2", type: "WRONG_MATCH" }), "restore")).toBeUndefined();
    expect(get(facts({ severity: "SEV2", type: "OTHER" }), "restore")).toBeUndefined();
    expect(get(facts({ severity: "SEV2", type: "PARTNER_DEGRADED" }), "restore")).toBeDefined();
    expect(get(facts({ severity: "SEV2", type: "INTEGRATION_BLOCKER" }), "restore")).toBeDefined();
  });

  it("stops when the owner records Service restored, and Resolve restores too", () => {
    const restored = at("2026-10-04T22:30:00+02:00");
    const d = get(facts({ restoredAt: restored }), "restore")!;
    expect(d.state).toBe("done");
    expect(d.doneAt).toEqual(restored);
    expect(d.dueAt).toBeNull();
    const viaResolve = get(facts({ status: "RESOLVED", resolvedAt: at("2026-10-05T10:00:00+02:00") }), "restore")!;
    expect(viaResolve.state).toBe("done");
    expect(viaResolve.doneAt).toEqual(at("2026-10-05T10:00:00+02:00"));
  });
});

describe("Resolve (owner)", () => {
  it("Sev-1 has none: restoring the service is the target", () => {
    expect(get(facts(), "resolve")).toBeUndefined();
  });

  it("Sev-2: 5 business days. Sev-3: 10 business days", () => {
    const aware = at("2026-10-05T09:30:00+02:00");
    expect(get(facts({ severity: "SEV2", awareAt: aware }), "resolve")!.dueAt).toEqual(at("2026-10-12T09:30:00+02:00"));
    expect(get(facts({ severity: "SEV3", awareAt: aware }), "resolve")!.dueAt).toEqual(at("2026-10-19T09:30:00+02:00"));
    expect(get(facts({ severity: "SEV3", awareAt: aware }), "resolve")!.targetMinutes).toBe(10 * 540);
  });

  it("Sev-4 and linked issues have none, and it stops at Resolve", () => {
    expect(get(facts({ severity: "SEV4" }), "resolve")).toBeUndefined();
    expect(get(facts({ severity: "SEV2", isLinkedChild: true }), "resolve")).toBeUndefined();
    const d = get(facts({ severity: "SEV2", status: "RESOLVED", resolvedAt: at("2026-10-05T10:00:00+02:00") }), "resolve")!;
    expect(d.state).toBe("done");
  });
});

describe("Customer update (communicator, repeating)", () => {
  it("Sev-1 before restore: every 60 min from the first notification, and from each update", () => {
    const first = get(facts(), "update")!;
    expect(first.dueAt).toEqual(at("2026-10-04T23:05:00+02:00")); // 22:05 + 60 min
    expect(first.repeating).toBe(true);
    const restarted = get(facts({ lastUpdateAt: at("2026-10-05T09:30:00+02:00") }), "update")!;
    expect(restarted.dueAt).toEqual(at("2026-10-05T10:30:00+02:00"));
  });

  it("Sev-1 after restore: every 4 h from the last update", () => {
    const d = get(facts({ restoredAt: at("2026-10-04T22:30:00+02:00"), lastUpdateAt: at("2026-10-05T09:30:00+02:00") }), "update")!;
    expect(d.dueAt).toEqual(at("2026-10-05T13:30:00+02:00"));
    expect(d.targetMinutes).toBe(240);
  });

  it("an update older than the first notification does not move the start", () => {
    const d = get(facts({ lastUpdateAt: at("2026-10-04T20:00:00+02:00") }), "update")!;
    expect(d.dueAt).toEqual(at("2026-10-04T23:05:00+02:00"));
  });

  it("Sev-2: every 4 business hours", () => {
    const d = get(facts({ severity: "SEV2", notifiedAt: at("2026-10-05T16:00:00+02:00") }), "update")!;
    expect(d.dueAt).toEqual(at("2026-10-06T11:00:00+02:00")); // 2 business hours today (16:00 to 18:00), 2 tomorrow from 09:00
    expect(d.business).toBe(true);
  });

  it("none at Sev-3 and Sev-4, before the customer is notified, on a partner issue, or once resolved", () => {
    expect(get(facts({ severity: "SEV3", notifyRequired: false }), "update")).toBeUndefined();
    expect(get(facts({ severity: "SEV4", notifyRequired: false }), "update")).toBeUndefined();
    expect(get(facts({ notifiedAt: null }), "update")).toBeUndefined();
    expect(get(facts({ isPartnerIssue: true }), "update")).toBeUndefined();
    expect(get(facts({ status: "RESOLVED", resolvedAt: at("2026-10-05T10:00:00+02:00") }), "update")).toBeUndefined();
  });
});

describe("Facts for the regulator (communicator, once)", () => {
  const assessed = at("2026-10-04T21:40:00+02:00");

  it("is on only when the caller says the contract and the assessment ask for it", () => {
    expect(get(facts(), "facts")).toBeUndefined();
    const d = get(facts({ factsHours: 2, factsStartAt: assessed }), "facts")!;
    expect(d.dueAt).toEqual(at("2026-10-04T23:40:00+02:00"));
    expect(d.role).toBe("Communicator");
    expect(d.repeating).toBe(false);
  });

  it("takes the contract's hours, whatever they are", () => {
    expect(get(facts({ factsHours: 4, factsStartAt: assessed }), "facts")!.dueAt).toEqual(at("2026-10-05T01:40:00+02:00"));
    expect(get(facts({ factsHours: 72, factsStartAt: assessed }), "facts")!.dueAt).toEqual(at("2026-10-07T21:40:00+02:00"));
  });

  it("is done once, when the facts pack is recorded", () => {
    const sent = at("2026-10-04T22:50:00+02:00");
    const d = get(facts({ factsHours: 2, factsStartAt: assessed, factsSentAt: sent }), "facts")!;
    expect(d.state).toBe("done");
    expect(d.doneAt).toEqual(sent);
  });
});

describe("Confirm resolution (communicator)", () => {
  it("runs for 1 business day from the resolution at Sev-1 and Sev-2, until the closure is recorded", () => {
    const resolvedAt = at("2026-10-05T17:00:00+02:00");
    const d = get(facts({ status: "RESOLVED", resolvedAt }), "confirm")!;
    expect(d.dueAt).toEqual(at("2026-10-06T17:00:00+02:00"));
    const confirmed = get(facts({ status: "RESOLVED", resolvedAt, closureConfirmedAt: at("2026-10-06T09:00:00+02:00") }), "confirm")!;
    expect(confirmed.state).toBe("done");
    expect(get(facts({ severity: "SEV3", status: "RESOLVED", resolvedAt }), "confirm")).toBeUndefined();
    expect(get(facts({ status: "IN_PROGRESS" }), "confirm")).toBeUndefined();
  });
});

describe("Partner chase (owner, repeating)", () => {
  const partner = (over: Partial<DeadlineFacts> = {}) => facts({ isPartnerIssue: true, type: "PARTNER_DEGRADED", notifyRequired: false, notifiedAt: null, ...over });

  it("Sev-1: every 60 min, restarting at each contact with the partner", () => {
    expect(get(partner(), "chase")!.dueAt).toEqual(at("2026-10-04T22:12:00+02:00"));
    const d = get(partner({ lastPartnerContactAt: at("2026-10-05T09:40:00+02:00") }), "chase")!;
    expect(d.dueAt).toEqual(at("2026-10-05T10:40:00+02:00"));
    expect(d.repeating).toBe(true);
  });

  it("Sev-2: 4 business hours. Sev-3: 2 business days. Sev-4: none", () => {
    const aware = at("2026-10-05T09:30:00+02:00");
    expect(get(partner({ severity: "SEV2", awareAt: aware }), "chase")!.dueAt).toEqual(at("2026-10-05T13:30:00+02:00"));
    expect(get(partner({ severity: "SEV3", awareAt: aware }), "chase")!.dueAt).toEqual(at("2026-10-07T09:30:00+02:00"));
    expect(get(partner({ severity: "SEV4" }), "chase")).toBeUndefined();
  });

  it("only on a partner issue, and not once resolved", () => {
    expect(get(facts(), "chase")).toBeUndefined();
    expect(get(partner({ status: "RESOLVED", resolvedAt: MON_1005 }), "chase")).toBeUndefined();
  });

  it("WAITING_ON_PARTNER pauses nothing", () => {
    const running = get(partner({ status: "WAITING_ON_PARTNER" }), "chase")!;
    expect(running.state).toBe("open");
    expect(get(partner({ status: "WAITING_ON_PARTNER" }), "restore")!.state).toBe("open");
  });
});

describe("Reply to customer (owner)", () => {
  const billing = (over: Partial<DeadlineFacts> = {}) => facts({ type: "BILLING", severity: "SEV3", notifyRequired: false, notifiedAt: null, awareAt: at("2026-10-05T09:30:00+02:00"), ...over });

  it("BILLING and COMMERCIAL_COVERAGE at Sev-2 or Sev-3: 5 business days", () => {
    expect(get(billing(), "reply")!.dueAt).toEqual(at("2026-10-12T09:30:00+02:00"));
    expect(get(billing({ severity: "SEV2" }), "reply")!.dueAt).toEqual(at("2026-10-12T09:30:00+02:00"));
    expect(get(billing({ type: "COMMERCIAL_COVERAGE" }), "reply")).toBeDefined();
  });

  it("not for other types, at Sev-1 or Sev-4, or on a linked issue; done at the first reply", () => {
    expect(get(facts({ severity: "SEV3" }), "reply")).toBeUndefined();
    expect(get(billing({ severity: "SEV1" }), "reply")).toBeUndefined();
    expect(get(billing({ severity: "SEV4" }), "reply")).toBeUndefined();
    const replied = at("2026-10-06T11:00:00+02:00");
    expect(get(billing({ repliedAt: replied }), "reply")).toMatchObject({ state: "done", doneAt: replied });
  });

  it("BILLING has a Reply clock and no Restore clock", () => {
    expect(get(billing({ severity: "SEV2" }), "restore")).toBeUndefined();
  });
});

describe("Waiting on customer pauses Restore, Resolve and Reply, and keeps the paused minutes", () => {
  const sev2 = (over: Partial<DeadlineFacts> = {}) => facts({ severity: "SEV2", awareAt: at("2026-10-05T09:00:00+02:00"), notifiedAt: at("2026-10-05T09:30:00+02:00"), ...over });

  it("while paused: state paused, the due time moves with the clock, nothing goes overdue", () => {
    const since = at("2026-10-05T10:00:00+02:00");
    const f = sev2({ status: "WAITING_ON_CUSTOMER", waitingOnCustomerSince: since });
    const early = get(f, "restore", at("2026-10-05T10:30:00+02:00"))!;
    const late = get(f, "restore", at("2026-10-06T10:30:00+02:00"))!;
    expect(early.state).toBe("paused");
    expect(early.pausedFor).toBe("Waiting on customer");
    expect(early.pausedSince).toEqual(since);
    // Frozen: the same time is left however long the pause lasts (1 business day of 540 minutes, 60 used before the pause).
    expect(early.remainingMinutes).toBe(480);
    expect(late.remainingMinutes).toBe(480);
    expect(deadlineTone(late, at("2026-10-06T10:30:00+02:00"))).toBe("paused");
    expect(get(f, "resolve", late.dueAt!)!.state).toBe("paused");
  });

  it("after the pause: the paused business minutes are added, so the clock resumes where it stopped", () => {
    // Paused 10:00 to 12:00 on Monday = 120 business minutes.
    const resumed = sev2({ pausedBusinessMinutes: 120, pausedMinutes: 120 });
    const d = get(resumed, "restore", at("2026-10-05T12:00:00+02:00"))!;
    expect(d.state).toBe("open");
    expect(d.dueAt).toEqual(at("2026-10-06T11:00:00+02:00")); // without the pause: Tue 09:00
    expect(d.remainingMinutes).toBe(480);
  });

  it("24/7 clocks shift by wall minutes", () => {
    const f = facts({ pausedMinutes: 90 });
    expect(get(f, "restore")!.dueAt).toEqual(at("2026-10-05T02:42:00+02:00")); // 01:12 + 90 min
  });

  it("does not pause Update, Confirm resolution, Facts or Chase", () => {
    const since = at("2026-10-05T09:40:00+02:00");
    const f = facts({ status: "WAITING_ON_CUSTOMER", waitingOnCustomerSince: since, factsHours: 2, factsStartAt: at("2026-10-04T21:40:00+02:00") });
    expect(get(f, "update")!.state).toBe("open");
    expect(get(f, "facts")!.state).toBe("open");
    const partner = facts({ isPartnerIssue: true, status: "WAITING_ON_CUSTOMER", waitingOnCustomerSince: since });
    expect(get(partner, "chase")!.state).toBe("open");
  });

  it("a pause that is not Waiting on customer is ignored", () => {
    const f = facts({ severity: "SEV2", status: "IN_PROGRESS", waitingOnCustomerSince: at("2026-10-05T09:00:00+02:00"), awareAt: at("2026-10-05T09:00:00+02:00") });
    expect(get(f, "restore")!.state).toBe("open");
  });
});

describe("addTarget", () => {
  it("adds business minutes across a weekend, wall minutes otherwise", () => {
    expect(addTarget(at("2026-10-09T17:00:00+02:00"), { minutes: 120, business: true }, CAL)).toEqual(at("2026-10-12T10:00:00+02:00"));
    expect(addTarget(at("2026-10-09T17:00:00+02:00"), { minutes: 120, business: false }, CAL)).toEqual(at("2026-10-09T19:00:00+02:00"));
    expect(addTarget(at("2026-10-09T17:00:00+02:00"), { minutes: 120, business: true }, null)).toEqual(at("2026-10-09T19:00:00+02:00"));
  });
});

describe("colours: red when breached, orange under 60 min or under 25% of the target, whichever comes first", () => {
  const dl = (dueAt: Date, share: number | null, state: "open" | "paused" | "done" = "open") => ({ dueAt, share, state });
  const now = MON_1005;

  it("red once a minute past the due time", () => {
    expect(deadlineTone(dl(new Date(now.getTime() - 2 * MIN), -0.1), now)).toBe("over");
    expect(deadlineTone(dl(new Date(now.getTime() - 30_000), 0), now)).not.toBe("over");
  });

  it("orange under 60 minutes, even with a large share left", () => {
    expect(deadlineTone(dl(new Date(now.getTime() + 59 * MIN), 0.9), now)).toBe("soon");
    expect(deadlineTone(dl(new Date(now.getTime() + 61 * MIN), 0.9), now)).toBe("default");
  });

  it("orange under 25% of the target, even with more than an hour left", () => {
    // Restore Sev-1 (240 min): 59 min is 24.6%, and under 60 anyway. A 1 business day target (540): 130 min left is 24%.
    expect(deadlineTone(dl(new Date(now.getTime() + 130 * MIN), 130 / 540), now)).toBe("soon");
    expect(deadlineTone(dl(new Date(now.getTime() + 136 * MIN), 136 / 540), now)).toBe("default");
  });

  it("paused and done are never orange or red", () => {
    expect(isSoon(dl(new Date(now.getTime() + 10 * MIN), 0.05, "paused"), now)).toBe(false);
    expect(deadlineTone(dl(new Date(now.getTime() - 10 * MIN), 0, "paused"), now)).toBe("paused");
    expect(deadlineTone({ dueAt: null, share: null, state: "done" }, now)).toBe("none");
  });

  it("soonAt is the earlier of 60 minutes before due and 25% of the target left, in the clock's own minutes", () => {
    // Restore Sev-1: 240 min, due 01:12. 25% is 60 min before, the same instant as the 60 minute rule.
    const wall = get(facts(), "restore")!;
    expect(wall.soonAt).toEqual(at("2026-10-05T00:12:00+02:00"));
    // Resolve Sev-2: 5 business days. 25% is 1 business day plus 3 hours (675 business minutes) before due, far earlier than 60 minutes.
    const long = get(facts({ severity: "SEV2", awareAt: at("2026-10-05T09:30:00+02:00") }), "resolve")!;
    expect(long.dueAt).toEqual(at("2026-10-12T09:30:00+02:00"));
    expect(long.soonAt!.getTime()).toBeLessThan(long.dueAt!.getTime() - 24 * 60 * MIN);
    expect(isSoon(long, at("2026-10-12T08:00:00+02:00"))).toBe(true);
    expect(isSoon(long, at("2026-10-06T09:30:00+02:00"))).toBe(false);
    // A paused clock has none.
    expect(get(facts({ severity: "SEV2", status: "WAITING_ON_CUSTOMER", waitingOnCustomerSince: at("2026-10-05T09:40:00+02:00"), awareAt: at("2026-10-05T09:00:00+02:00") }), "restore")!.soonAt).toBeNull();
  });

  it("the share comes out of the engine", () => {
    const d = get(facts(), "restore", at("2026-10-05T00:12:00+02:00"))!; // 60 of 240 min left
    expect(d.share).toBeCloseTo(0.25, 5);
    expect(d.remainingMinutes).toBe(60);
  });
});
