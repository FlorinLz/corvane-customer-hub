import { cookies } from "next/headers";

import { visitorClockEnabled } from "@/lib/dates";
import { parseArrival, VISITOR_CLOCK_COOKIE } from "@/lib/visitor-clock";
import { idleRestoreEnabled, needsPreparing, readDemoState } from "@/server/demo-idle";

/**
 * Whether this page request must show "Preparing a fresh demo..." instead of the app: a restore is due or running, or the visitor arrived
 * before the last restore. Read before anything else touches the database. A failure here (for example a migration not applied yet) must
 * not take the site down, so it answers false and the page renders as it did before.
 */
export async function demoNeedsPreparing(): Promise<boolean> {
  if (!idleRestoreEnabled()) return false;
  // Outside the try: during a build, cookies() throws Next's "dynamic usage" signal, which must reach Next, not be swallowed here.
  const jar = await cookies();
  try {
    const state = await readDemoState();
    if (!state) return false;
    const arrival = visitorClockEnabled() ? parseArrival(jar.get(VISITOR_CLOCK_COOKIE)?.value, Date.now()) : undefined;
    return needsPreparing(state, arrival);
  } catch (err) {
    console.error("[demo-idle] could not read the demo state", err);
    return false;
  }
}
