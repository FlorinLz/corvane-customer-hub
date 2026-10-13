"use client";

import * as React from "react";

/**
 * Brief 4.9.5: "Texts refresh at least every 60 seconds in the browser
 * from serverNow". Shared by IssueClocksPanel and the Issue page's own
 * deadline banner so both tick from the same baseline on the same
 * cadence -- a banner computed once, server-side, at page render while
 * the clocks below it kept ticking client-side is exactly how the two
 * fell out of sync and showed different "Overdue by" values for the
 * same clock.
 */
export function useTickingNow(serverNow: Date): Date {
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
  return new Date(serverNow.getTime() + elapsedTicks * 60_000);
}
