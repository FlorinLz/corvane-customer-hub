import { describe, expect, it } from "vitest";

import { dayText, timelineText } from "@/lib/time-block";
import { formatInZone } from "@/lib/time-zones";
import { compareHomeRows, type HomeSortKey } from "@/server/derived/role-actions";

/** The one date-time format of the app: "Mon 05 Oct, 16:48 MYT", the year only when it is not the current year, "Sep" never "Sept". */
describe("formatInZone", () => {
  const now = new Date("2026-10-05T08:48:00Z");

  it("reads weekday, day, month, time and zone label", () => {
    expect(formatInZone(new Date("2026-10-05T08:48:00Z"), "Asia/Kuala_Lumpur", { now })).toBe("Mon 05 Oct, 16:48 MYT");
    expect(formatInZone(new Date("2026-10-04T19:21:00Z"), "Europe/Amsterdam", { now })).toBe("Sun 04 Oct, 21:21 CEST");
  });

  it("adds the year only when it differs from the current year", () => {
    expect(formatInZone(new Date("2027-01-12T10:05:00Z"), "Europe/London", { now })).toBe("Tue 12 Jan 2027, 10:05 GMT");
    expect(formatInZone(new Date("2025-12-31T10:00:00Z"), "Asia/Singapore", { now })).toBe("Wed 31 Dec 2025, 18:00 SGT");
  });

  it("spells September 'Sep', never 'Sept'", () => {
    expect(formatInZone(new Date("2026-09-15T10:05:00Z"), "Europe/Paris", { now })).toBe("Tue 15 Sep, 12:05 CEST");
    expect(dayText(new Date("2026-09-15T10:05:00Z"), now, "Europe/Paris")).toBe("Tue 15 Sep");
  });

  it("gives just the time and zone with timeOnly, and the Timeline value is the same string", () => {
    expect(formatInZone(new Date("2026-10-05T08:48:00Z"), "Asia/Singapore", { timeOnly: true })).toBe("16:48 SGT");
    expect(timelineText(new Date("2026-10-05T08:48:00Z"), now, "Asia/Singapore")).toBe("Mon 05 Oct, 16:48 SGT");
  });
});

describe("compareHomeRows", () => {
  const base: HomeSortKey = { hasAction: true, dueAt: null, severity: "SEV2", awareAt: new Date("2026-10-01T10:00:00Z"), number: 1 };

  it("puts Resolved and Closed issues after every open issue, whoever holds the action", () => {
    const resolvedWithAction = { ...base, finished: true, dueAt: new Date("2026-10-05T08:00:00Z"), severity: "SEV1" as const, number: 2 };
    const openWaiting = { ...base, hasAction: false, number: 3 };
    expect([resolvedWithAction, openWaiting].sort(compareHomeRows).map((r) => r.number)).toEqual([3, 2]);
  });
});
