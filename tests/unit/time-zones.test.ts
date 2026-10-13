import { describe, expect, it } from "vitest";

import { splitInZone, zonedDateTimeToUtc } from "@/lib/time-zones";

/**
 * Milestone 8 live fix. Root cause: `new Date(`${date}T${time}`)` (no
 * offset in the string) parses the wall-clock numbers in whatever time
 * zone the *host running the code* happens to be in -- the server's
 * system zone server-side, the browser's own system zone client-side
 * (ECMA-262), neither of which is necessarily the viewer's own
 * configured zone. `splitInZone`/`zonedDateTimeToUtc` never read the
 * host's own zone: every `Intl.DateTimeFormat`/`TZDate` call here takes
 * an explicit `timeZone`, so these are correct regardless of the zone
 * the test runner (or, in production, the Node process or the browser)
 * happens to be running in -- these tests assert exact instants by hand
 * rather than relying on `process.env.TZ`, so they'd catch a regression
 * to the implicit-zone behaviour even if run on a UTC CI box.
 *
 * `zonedDateTimeToUtc` returns a `TZDate` (business-hours.ts's own
 * `zonedInstant`, re-exported): its `toISOString()` prints with an
 * explicit numeric offset ("...+02:00") rather than normalising to "Z",
 * which represents the exact same instant (any ISO-8601 string with an
 * explicit offset parses to the same instant regardless of host zone)
 * but doesn't string-compare equal to a "Z"-suffixed literal -- these
 * tests compare `.getTime()` (the actual instant) against hand-computed
 * `Date.UTC(...)` values instead of comparing ISO strings.
 */
describe("lib/time-zones: splitInZone / zonedDateTimeToUtc", () => {
  it("splitInZone reads CEST (UTC+2 in October), SGT and MYT (both UTC+8, no DST) correctly for the same instant", () => {
    const instant = new Date("2026-10-06T11:14:00.000Z"); // the user's own report: "Demo clock strip showed 13:14 CEST"
    expect(splitInZone(instant, "Europe/Amsterdam")).toEqual({ date: "2026-10-06", time: "13:14" });
    expect(splitInZone(instant, "Asia/Singapore")).toEqual({ date: "2026-10-06", time: "19:14" });
    expect(splitInZone(instant, "Asia/Kuala_Lumpur")).toEqual({ date: "2026-10-06", time: "19:14" });
  });

  it("zonedDateTimeToUtc is the exact inverse of splitInZone for CEST, SGT and MYT", () => {
    const expected = Date.UTC(2026, 9, 6, 11, 14);
    expect(zonedDateTimeToUtc("2026-10-06", "13:14", "Europe/Amsterdam").getTime()).toBe(expected);
    expect(zonedDateTimeToUtc("2026-10-06", "19:14", "Asia/Singapore").getTime()).toBe(expected);
    expect(zonedDateTimeToUtc("2026-10-06", "19:14", "Asia/Kuala_Lumpur").getTime()).toBe(expected);
  });

  it("the UTC instant zonedDateTimeToUtc returns round-trips through JSON (toISOString then new Date()) to the identical instant", () => {
    // This is the exact path the app takes: the client calls .toISOString() to
    // build the request body, the server does `new Date(input.occurredAt)`.
    const instant = zonedDateTimeToUtc("2026-10-06", "13:14", "Europe/Amsterdam");
    const roundTripped = new Date(instant.toISOString());
    expect(roundTripped.getTime()).toBe(instant.getTime());
    expect(instant.getTime()).toBe(Date.UTC(2026, 9, 6, 11, 14));
  });

  it("round-trips through splitInZone then zonedDateTimeToUtc back to the original instant, for several zones", () => {
    const instant = new Date("2026-10-06T19:42:17.000Z");
    for (const zone of ["Europe/Amsterdam", "Asia/Singapore", "Asia/Kuala_Lumpur", "America/New_York", "Europe/London"]) {
      const { date, time } = splitInZone(instant, zone);
      const roundTripped = zonedDateTimeToUtc(date, time, zone);
      // splitInZone drops seconds (an <input type="time"> field has none), so the round trip
      // is exact to the minute, not the second.
      expect(roundTripped.getTime()).toBe(instant.getTime() - 17_000);
    }
  });

  /**
   * The user's own reported production scenario, verbatim: "Viewer:
   * Emma Wilson. Browser time zone: Europe/Bucharest (EEST, UTC+3).
   * Demo clock strip showed 13:14 CEST. Issue: ISS-1042 (MPS), status
   * Resolved at 12:52 CEST. Action: Confirm resolution with the customer. I entered
   * 13:10 in the Close dialog time field." -- entering 13:10 must parse
   * as 13:10 in the viewer's own CEST zone (Europe/Amsterdam, the
   * demo's own reference CEST zone, src/components/shell/DemoClock.tsx)
   * regardless of what the browser's own system zone reads, landing
   * strictly between Resolved at (12:52 CEST) and the demo clock's own
   * "now" (13:14 CEST) -- so the server's "can't be before Resolved
   * at" / "can't be in the future" checks both pass.
   */
  it("the exact reported scenario: 13:10 entered in CEST, with Resolved at 12:52 CEST and now() at 13:14 CEST, parses strictly between the two", () => {
    const resolvedAt = zonedDateTimeToUtc("2026-10-06", "12:52", "Europe/Amsterdam");
    const demoNow = zonedDateTimeToUtc("2026-10-06", "13:14", "Europe/Amsterdam");
    const entered = zonedDateTimeToUtc("2026-10-06", "13:10", "Europe/Amsterdam");

    expect(resolvedAt.getTime()).toBe(Date.UTC(2026, 9, 6, 10, 52));
    expect(demoNow.getTime()).toBe(Date.UTC(2026, 9, 6, 11, 14));
    expect(entered.getTime()).toBe(Date.UTC(2026, 9, 6, 11, 10));
    expect(entered.getTime()).toBeGreaterThan(resolvedAt.getTime());
    expect(entered.getTime()).toBeLessThan(demoNow.getTime());

    // What the removed bug actually did: `new Date("2026-10-06T13:10")` parsed in a
    // browser whose own system zone is Europe/Bucharest (EEST, UTC+3, one hour ahead
    // of CEST) reads the same wall-clock digits as 13:10 EEST = 10:10 UTC -- *before*
    // Resolved at (10:52 UTC), which is exactly the false "can't be before Resolved
    // at" the user hit. zonedDateTimeToUtc never does this: it has no implicit
    // dependency on any host's own zone, Bucharest included.
    const buggyBucharestParse = new Date(Date.UTC(2026, 9, 6, 13 - 3, 10));
    expect(buggyBucharestParse.getTime()).toBeLessThan(resolvedAt.getTime());
    expect(entered.getTime()).not.toBe(buggyBucharestParse.getTime());
  });

  it("handles a date/time pair spanning midnight in the viewer's zone (SGT is 8h ahead of UTC)", () => {
    // 01:30 SGT on 07 Oct is 17:30 UTC on the *previous* day, 06 Oct.
    expect(zonedDateTimeToUtc("2026-10-07", "01:30", "Asia/Singapore").getTime()).toBe(Date.UTC(2026, 9, 6, 17, 30));
  });
});
