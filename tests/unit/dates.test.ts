import { describe, expect, it, vi } from "vitest";

import { addDays, businessDaysBetween, computeClockOffsetMs, formatDate, today } from "@/lib/dates";

describe("lib/dates", () => {
  it("today() returns a YYYY-MM-DD date", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("addDays() moves the calendar date forward and backward", () => {
    expect(addDays("2026-10-03", 1)).toBe("2026-10-04");
    expect(addDays("2026-10-03", -3)).toBe("2026-09-30");
  });

  it("formatDate() renders the brief's display format", () => {
    expect(formatDate("2026-10-02")).toBe("02 Oct 2026");
  });

  it("businessDaysBetween() counts Monday-to-Friday only", () => {
    // Fri 02 Oct 2026 -> Mon 05 Oct 2026 is 1 business day.
    expect(businessDaysBetween("2026-10-02", "2026-10-05")).toBe(1);
    // Mon 05 Oct 2026 -> Fri 02 Oct 2026 is -1 business day.
    expect(businessDaysBetween("2026-10-05", "2026-10-02")).toBe(-1);
    expect(businessDaysBetween("2026-10-03", "2026-10-03")).toBe(0);
  });
});

describe("computeClockOffsetMs() (milestone 8, DEMO_CLOCK_ANCHOR)", () => {
  const START = "2026-10-05T08:05:00Z";
  const startMs = new Date(START).getTime();

  it("with no DEMO_CLOCK_START, the offset is 0 regardless of environment", () => {
    expect(computeClockOffsetMs({}, Date.now())).toBe(0);
    expect(computeClockOffsetMs({ DEMO_MODE: "true" }, Date.now())).toBe(0);
  });

  it("outside production, with no DEMO_CLOCK_ANCHOR, the offset is anchored to the given real-now (the pre-existing per-process behaviour)", () => {
    const realNow = startMs - 10 * 60_000; // "process started" 10 minutes before the demo day
    const offset = computeClockOffsetMs({ DEMO_CLOCK_START: START }, realNow);
    expect(realNow + offset).toBe(startMs); // now() at that same real-now reads exactly DEMO_CLOCK_START
  });

  it("in production, DEMO_CLOCK_START is ignored unless DEMO_MODE=true", () => {
    expect(computeClockOffsetMs({ NODE_ENV: "production", DEMO_CLOCK_START: START }, Date.now())).toBe(0);
    const realNow = startMs - 60_000;
    const offset = computeClockOffsetMs({ NODE_ENV: "production", DEMO_MODE: "true", DEMO_CLOCK_START: START }, realNow);
    expect(realNow + offset).toBe(startMs);
  });

  it("with DEMO_CLOCK_ANCHOR set, the offset is a constant independent of the caller's real-now (what makes it consistent across serverless instances)", () => {
    const anchor = "2026-10-05T07:55:00Z"; // set 10 real minutes before the demo day
    const env = { DEMO_CLOCK_START: START, DEMO_CLOCK_ANCHOR: anchor };
    const offsetA = computeClockOffsetMs(env, Date.now());
    const offsetB = computeClockOffsetMs(env, Date.now() + 3 * 60 * 60_000); // a "different instance", 3 real hours later
    expect(offsetA).toBe(offsetB);
  });

  it("with DEMO_CLOCK_ANCHOR set, now() = DEMO_CLOCK_START + (real now - DEMO_CLOCK_ANCHOR), and keeps advancing in real time", () => {
    const anchorMs = startMs - 5 * 60_000; // anchor set 5 minutes before the demo day
    const env = { DEMO_CLOCK_START: START, DEMO_CLOCK_ANCHOR: new Date(anchorMs).toISOString() };

    // Right at the anchor instant, now() reads exactly DEMO_CLOCK_START.
    const offsetAtAnchor = computeClockOffsetMs(env, anchorMs);
    expect(anchorMs + offsetAtAnchor).toBe(startMs);

    // 20 real minutes after the anchor, now() reads DEMO_CLOCK_START + 20 minutes, on the same
    // offset (i.e. the same constant, not recomputed from the later real-now).
    const realNowLater = anchorMs + 20 * 60_000;
    const offsetLater = computeClockOffsetMs(env, realNowLater);
    expect(offsetLater).toBe(offsetAtAnchor);
    expect(realNowLater + offsetLater).toBe(startMs + 20 * 60_000);
  });

  it("a malformed DEMO_CLOCK_ANCHOR falls back to the per-real-now behaviour rather than throwing", () => {
    const realNow = startMs - 60_000;
    const offset = computeClockOffsetMs({ DEMO_CLOCK_START: START, DEMO_CLOCK_ANCHOR: "not-a-date" }, realNow);
    expect(realNow + offset).toBe(startMs);
  });
});

describe("next.config.ts derives NEXT_PUBLIC_-prefixed aliases for the demo clock env vars (demo-clock-writes bug fix)", () => {
  // `next build` uses Turbopack by default (Next 16), which does not inline
  // next.config.ts's legacy `env` key into client bundles the way webpack's
  // DefinePlugin did -- the mapping this describe block used to assert
  // existed, but silently never reached the browser, leaving every
  // "use client" today()/now() call reading real, unoffset time no matter
  // what DEMO_CLOCK_START said. NEXT_PUBLIC_-prefixed vars are the one
  // inlining mechanism Next guarantees under either bundler; next.config.ts
  // now derives them, at module load, from the same (unrenamed) vars below,
  // so a client bundle's own process.env.NEXT_PUBLIC_DEMO_CLOCK_START reads
  // the right value with no deployment config changes.
  const KEYS = ["DEMO_MODE", "DEMO_CLOCK_START", "DEMO_CLOCK_ANCHOR"] as const;

  it("sets NEXT_PUBLIC_DEMO_MODE, NEXT_PUBLIC_DEMO_CLOCK_START and NEXT_PUBLIC_DEMO_CLOCK_ANCHOR from their own unprefixed vars", async () => {
    const saved = Object.fromEntries(KEYS.flatMap((k) => [[k, process.env[k]], [`NEXT_PUBLIC_${k}`, process.env[`NEXT_PUBLIC_${k}`]]]));
    try {
      process.env.DEMO_MODE = "true";
      process.env.DEMO_CLOCK_START = "2026-10-05T08:05:00Z";
      process.env.DEMO_CLOCK_ANCHOR = "2026-10-05T07:55:00Z";
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
      delete process.env.NEXT_PUBLIC_DEMO_CLOCK_START;
      delete process.env.NEXT_PUBLIC_DEMO_CLOCK_ANCHOR;

      vi.resetModules();
      await import("../../next.config");

      expect(process.env.NEXT_PUBLIC_DEMO_MODE).toBe("true");
      expect(process.env.NEXT_PUBLIC_DEMO_CLOCK_START).toBe("2026-10-05T08:05:00Z");
      expect(process.env.NEXT_PUBLIC_DEMO_CLOCK_ANCHOR).toBe("2026-10-05T07:55:00Z");
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
