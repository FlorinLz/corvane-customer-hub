import { AsyncLocalStorage } from "node:async_hooks";
// Next's own request storage: the only synchronous way to see the current request's cookies. now() is synchronous and
// called from ~150 places, so it cannot await cookies(). The "external" module is the one instance Next shares between
// bundles, which is what makes it safe to import from here.
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";

import { freshClockOffsetMs, type ServerClockHook } from "@/lib/dates";
import { parseArrival, VISITOR_CLOCK_COOKIE } from "@/lib/visitor-clock";

// Shared through globalThis, not module state: a server may load this file once per bundle (route handlers, pages), but
// dates.ts, the pages and the handlers must all see the same forced-clock storage.
const globals = globalThis as { __corvaneClock?: ServerClockHook; __corvaneForcedClock?: AsyncLocalStorage<number> };
const forcedStorage = (globals.__corvaneForcedClock ??= new AsyncLocalStorage<number>());

/** Runs `fn` with the clock a visitor arriving right now would have, whatever visitor's request this is. Restores and seeds use it so the data is dated from DEMO_CLOCK_START. */
export function atFreshClock<T>(fn: () => Promise<T>): Promise<T> {
  return forcedStorage.run(freshClockOffsetMs(), fn);
}

globals.__corvaneClock = {
  forced: () => forcedStorage.getStore(),
  arrival: () => {
    const store = workUnitAsyncStorage.getStore();
    if (!store || store.type !== "request") return undefined;
    return parseArrival(store.cookies.get(VISITOR_CLOCK_COOKIE)?.value, Date.now());
  },
};
