/**
 * The per-visitor demo clock (portfolio runtime). A visitor's first request gets the cookie `ch_arrival` holding the real
 * instant they arrived (epoch ms). Their demo "now" is DEMO_CLOCK_START + (real now - arrival), so everyone starts the
 * demo at the same moment, Mon 05 Oct 2026 10:05 CEST, whenever they arrive, and the clock then runs in real time.
 * The cookie lasts 24 h; after that the next request starts the clock again. DEMO_CLOCK_ANCHOR, when set, overrides it
 * for everybody (tests, and the owner before an interview).
 */
export const VISITOR_CLOCK_COOKIE = "ch_arrival";
export const VISITOR_CLOCK_MAX_AGE_SECONDS = 24 * 60 * 60;

/**
 * The arrival in a cookie value, or undefined when it is missing or not credible: not a whole number, in the future
 * (a few seconds of slack for clock differences between instances), or older than the cookie lifetime. A visitor can edit
 * their own cookie; this keeps them from pushing their own clock further than a cookie could legitimately reach.
 */
export function parseArrival(value: string | undefined, realNowMs: number): number | undefined {
  if (!value || !/^\d{10,15}$/.test(value)) return undefined;
  const arrival = Number(value);
  if (arrival > realNowMs + 5_000) return undefined;
  if (arrival < realNowMs - (VISITOR_CLOCK_MAX_AGE_SECONDS + 3600) * 1000) return undefined;
  return arrival;
}
