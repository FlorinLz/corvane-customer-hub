import { describe, expect, it } from "vitest";

import { parseArrival, VISITOR_CLOCK_MAX_AGE_SECONDS } from "@/lib/visitor-clock";

describe("parseArrival()", () => {
  const nowMs = Date.UTC(2026, 9, 14, 12, 0, 0);

  it("accepts an arrival in the last 24 hours", () => {
    expect(parseArrival(String(nowMs - 5 * 60_000), nowMs)).toBe(nowMs - 5 * 60_000);
    expect(parseArrival(String(nowMs - VISITOR_CLOCK_MAX_AGE_SECONDS * 1000), nowMs)).toBeDefined();
  });

  it("rejects what a cookie cannot legitimately hold: missing, not a number, in the future, older than the cookie lifetime", () => {
    expect(parseArrival(undefined, nowMs)).toBeUndefined();
    expect(parseArrival("", nowMs)).toBeUndefined();
    expect(parseArrival("yesterday", nowMs)).toBeUndefined();
    expect(parseArrival("12.5", nowMs)).toBeUndefined();
    expect(parseArrival(String(nowMs + 60 * 60_000), nowMs)).toBeUndefined();
    expect(parseArrival(String(nowMs - 3 * 24 * 60 * 60_000), nowMs)).toBeUndefined();
  });

  it("tolerates a few seconds of clock difference between instances", () => {
    expect(parseArrival(String(nowMs + 2_000), nowMs)).toBe(nowMs + 2_000);
  });
});
