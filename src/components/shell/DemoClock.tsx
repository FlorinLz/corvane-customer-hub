"use client";

import * as React from "react";

import { formatInZone } from "@/lib/time-zones";

// The brief's own demo day is always phrased in CEST ("Monday 05 Oct 2026,
// 10:05 CEST"); Europe/Amsterdam is already each CS-team seeded user's own
// time zone (prisma/seed/data/users.ts), so it's the natural existing
// reference zone for CET/CEST rather than inventing a new one.
const DISPLAY_ZONE = "Europe/Amsterdam";

/**
 * Demo strip, right of "Demo mode": "Demo time: <...>", from the server
 * demo clock, ticking forward every minute in the browser from the
 * `serverNow` baseline -- same pattern as IssueClocksPanel (brief 4.9.5),
 * not the browser's own clock, which is exactly the class of bug this
 * milestone's live fixes address. DEMO_MODE-only (see DemoStrip).
 */
export function DemoClock({ serverNow }: { serverNow: Date }) {
  const [baseline, setBaseline] = React.useState(serverNow);
  const [elapsedTicks, setElapsedTicks] = React.useState(0);
  if (baseline !== serverNow) {
    setBaseline(serverNow);
    setElapsedTicks(0);
  }
  React.useEffect(() => {
    const id = setInterval(() => setElapsedTicks((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const display = new Date(serverNow.getTime() + elapsedTicks * 60_000);

  return <span className="shrink-0 text-white/85">Demo time: {formatInZone(display, DISPLAY_ZONE, { now: display })}</span>;
}
