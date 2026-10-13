import { describe, expect, it } from "vitest";

import { computeAvailability } from "@/server/derived/availability";

describe("computeAvailability", () => {
  it("24/7 is always available", () => {
    const r = computeAvailability({
      timeZone: "Europe/London",
      available24x7: true,
      availabilityDays: [],
      availabilityStart: null,
      availabilityEnd: null,
      now: new Date("2026-10-02T12:00:00Z"),
    });
    expect(r.isAvailableNow).toBe(true);
  });

  it("M7 edge case 1: Singapore Mon-Fri 09:00-18:00 at 15:00 Bucharest shows Outside availability", () => {
    // Friday 02 Oct 2026, 15:00 Europe/Bucharest (UTC+3) = 12:00 UTC = 20:00 Asia/Singapore.
    const r = computeAvailability({
      timeZone: "Asia/Singapore",
      available24x7: false,
      availabilityDays: [1, 2, 3, 4, 5],
      availabilityStart: "09:00",
      availabilityEnd: "18:00",
      now: new Date("2026-10-02T12:00:00Z"),
    });
    expect(r.localTime).toBe("20:00");
    expect(r.isAvailableNow).toBe(false);
  });

  it("M7 edge case 2: a window crossing midnight (22:00-06:00) is available on both sides", () => {
    const common = {
      timeZone: "UTC",
      available24x7: false,
      availabilityDays: [5], // Friday
      availabilityStart: "22:00",
      availabilityEnd: "06:00",
    };
    expect(computeAvailability({ ...common, now: new Date("2026-10-02T23:00:00Z") }).isAvailableNow).toBe(true); // Fri 23:00
    expect(computeAvailability({ ...common, now: new Date("2026-10-03T03:00:00Z") }).isAvailableNow).toBe(true); // Sat 03:00 (still inside Friday's window)
    expect(computeAvailability({ ...common, now: new Date("2026-10-03T10:00:00Z") }).isAvailableNow).toBe(false); // Sat 10:00
    expect(computeAvailability({ ...common, now: new Date("2026-10-02T20:00:00Z") }).isAvailableNow).toBe(false); // Fri 20:00, before the window opens
  });

  it("no availability data recorded", () => {
    const r = computeAvailability({
      timeZone: "Europe/Bucharest",
      available24x7: false,
      availabilityDays: [],
      availabilityStart: null,
      availabilityEnd: null,
      now: new Date("2026-10-02T12:00:00Z"),
    });
    expect(r.hasWindow).toBe(false);
    expect(r.isAvailableNow).toBe(false);
  });
});
