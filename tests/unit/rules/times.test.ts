import { describe, expect, it } from "vitest";

import { teamCalendar } from "@/lib/business-hours";
import { correctTimesSchema } from "@/lib/validation/issues";
import { ackStartFor, checkTimes, recalculateClocks, resolveNeedsEvent, TIMES_MESSAGES, type ClockSnapshot } from "@/server/issues/times";

// Three timestamps. Pure rules: no database.
const at = (iso: string) => new Date(`2026-10-05T${iso}:00.000Z`);
const NOW = at("12:00");

describe("order: Event <= Corvane aware at <= Opened <= now", () => {
  it("accepts times in order, and an unknown Event", () => {
    expect(checkTimes({ eventAt: at("09:40"), awareAt: at("10:00"), openedAt: at("10:10"), now: NOW })).toEqual({});
    expect(checkTimes({ eventAt: at("10:00"), awareAt: at("10:00"), now: NOW })).toEqual({}); // equal is "on or before"
    expect(checkTimes({ eventAt: null, awareAt: at("10:00"), now: NOW })).toEqual({});
  });

  it("Event after Corvane aware at: both fields carry the notes' messages", () => {
    const errors = checkTimes({ eventAt: at("10:30"), awareAt: at("10:00"), now: NOW });
    expect(errors.eventAt).toBe("Event can't be after Corvane aware at");
    expect(errors.awareAt).toBe("Corvane aware at can't be before the event");
  });

  it("Corvane aware at in the future", () => {
    expect(checkTimes({ eventAt: null, awareAt: at("12:01"), now: NOW }).awareAt).toBe("Corvane aware at can't be in the future");
  });

  it("Corvane aware at after the issue was opened (a correction)", () => {
    expect(checkTimes({ eventAt: null, awareAt: at("10:30"), openedAt: at("10:20"), now: NOW }).awareAt).toBe(TIMES_MESSAGES.awareAfterOpened);
  });

  it("an invalid date is refused, not compared", () => {
    expect(checkTimes({ eventAt: null, awareAt: new Date("nope"), now: NOW }).awareAt).toBe(TIMES_MESSAGES.awareInvalid);
    expect(checkTimes({ eventAt: new Date("nope"), awareAt: at("10:00"), now: NOW }).eventAt).toBe(TIMES_MESSAGES.eventInvalid);
  });
});

describe("correct times request", () => {
  const base = { version: 1 };
  it("reason is 10 to 500 characters", () => {
    expect(correctTimesSchema.safeParse({ ...base, reason: "Typo" }).success).toBe(false);
    expect(correctTimesSchema.safeParse({ ...base, reason: "x".repeat(501) }).success).toBe(false);
    expect(correctTimesSchema.safeParse({ ...base, reason: "The email reached the mailbox earlier." }).success).toBe(true);
  });
  it("Source is one of the five", () => {
    expect(correctTimesSchema.safeParse({ ...base, reason: "The email reached the mailbox earlier.", awarenessSource: "SMOKE_SIGNAL" }).success).toBe(false);
    for (const s of ["EMAIL", "PHONE", "CHAT", "MONITORING", "INTERNAL"]) {
      expect(correctTimesSchema.safeParse({ ...base, reason: "The email reached the mailbox earlier.", awarenessSource: s }).success).toBe(true);
    }
  });
});

describe("the acknowledge clock starts at Corvane aware at", () => {
  it("in hours: Corvane aware at, not the save time", () => {
    expect(ackStartFor(at("09:00"), at("09:20"), at("09:20")).toISOString()).toBe(at("09:00").toISOString());
  });
  it("deferred to the next business start (out of hours): that start", () => {
    const nextStart = new Date("2026-10-06T07:00:00.000Z");
    expect(ackStartFor(at("22:00"), nextStart, at("22:30"))).toEqual(nextStart);
  });
});

describe("a Sev-1 needs Event to be resolved", () => {
  it("Sev-1 with Event unknown does; Sev-2, or a known Event, does not", () => {
    expect(resolveNeedsEvent({ severity: "SEV1", eventAt: null })).toBe(true);
    expect(resolveNeedsEvent({ severity: "SEV1", eventAt: at("09:00") })).toBe(false);
    expect(resolveNeedsEvent({ severity: "SEV2", eventAt: null })).toBe(false);
  });
});

describe("recalculating deadlines after a correction", () => {
  const cal = teamCalendar("OPS");
  const open: ClockSnapshot = {
    severity: "SEV1", status: "IN_PROGRESS", createdAt: at("10:20"), clocksStartAt: at("10:20"),
    acknowledgedAt: null, ackStartAt: at("10:00"),
    notifyRequired: true, notifiedAt: null, notifyStartAt: at("10:00"), notifyTargetHours: 2, notifyTargetBusinessMins: null,
  };

  it("open deadlines count from the corrected Corvane aware at", () => {
    const patch = recalculateClocks(open, at("09:00"), cal, cal);
    expect(patch.ackStartAt).toEqual(at("09:00"));
    expect(patch.ackDueAt).toEqual(at("09:15")); // Sev-1: 15 min
    expect(patch.notifyStartAt).toEqual(at("09:00"));
    expect(patch.notifyDueAt).toEqual(at("11:00")); // the card's 2 h
  });

  it("a deadline already met stays met: acknowledged and notified keep their start", () => {
    expect(recalculateClocks({ ...open, acknowledgedAt: at("10:09") }, at("09:00"), cal, cal)).not.toHaveProperty("ackStartAt");
    expect(recalculateClocks({ ...open, notifiedAt: at("11:30") }, at("09:00"), cal, cal)).not.toHaveProperty("notifyStartAt");
  });

  it("the clocks of a resolved or closed issue do not change", () => {
    expect(recalculateClocks({ ...open, status: "RESOLVED" }, at("09:00"), cal, cal)).toEqual({});
    expect(recalculateClocks({ ...open, status: "CLOSED" }, at("09:00"), cal, cal)).toEqual({});
  });

  it("a linked issue has no acknowledge clock to recalculate", () => {
    expect(recalculateClocks({ ...open, ackStartAt: null }, at("09:00"), cal, cal)).not.toHaveProperty("ackStartAt");
  });
});
