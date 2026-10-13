/**
 * The clock. "Today" is the current date in APP_TIMEZONE (brief, Shared conventions;
 * env vars 3.1.5, 7.2.1). DEMO_CLOCK_START starts the clock at that instant and lets
 * it run from there, so a short test run stays effectively deterministic without
 * freezing time. Outside DEMO_MODE, ignored in production (NODE_ENV=production) so a
 * real production deployment can never have its clock offset by a stray env var.
 * Milestone 8 (decision, see DECISIONS.md): the demo's own production deployment
 * sets DEMO_MODE=true, so the interview's live Vercel URL runs the issue flow at the
 * pinned demo day regardless of the real calendar date -- gated on DEMO_MODE, not a
 * blanket removal of the NODE_ENV guard, so this stays inert on a hypothetical real
 * (non-demo) production deployment of this app.
 *
 * DEMO_CLOCK_ANCHOR (milestone 8): on a serverless platform, `clockOffsetMs` is
 * normally computed once per function instance, anchored to THAT instance's own
 * cold-start moment -- fine for one long-running local process, but on Vercel,
 * different instances cold-start at different real moments and so land on
 * different offsets, which can make the demo clock jump backwards after a cold
 * start (and reject a write with "the time can't be in the future" if a later
 * instance's clock reads earlier than an instant already written under an
 * earlier instance's more-advanced clock). Setting DEMO_CLOCK_ANCHOR to a real
 * ISO instant pins the offset to `DEMO_CLOCK_START - DEMO_CLOCK_ANCHOR`, a plain
 * constant derived from two env vars rather than `Date.now()` at load time --
 * every instance of the same deployment computes the identical offset, so the
 * clock reads consistently across instances and still advances in real time.
 * Unset (the default, and every non-demo use), behaviour is unchanged.
 *
 * Client Components may call today()/now() too (several dialogs prefill a
 * date/time field this way): next.config.ts's `env` key inlines these same
 * three vars into the client bundle under their existing names, since Next
 * otherwise only bundles NEXT_PUBLIC_-prefixed vars and these three would
 * silently read as `undefined` in the browser. That inlining happens once
 * at build time (same as DEMO_CLOCK_ANCHOR already requires for the
 * server), so client and server agree on the offset without needing a
 * value passed down as a prop.
 */

/** A calendar date with no time component, "YYYY-MM-DD". */
export type LocalDate = string;

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Bucharest";

interface ClockEnv {
  NODE_ENV?: string;
  DEMO_MODE?: string;
  DEMO_CLOCK_START?: string;
  DEMO_CLOCK_ANCHOR?: string;
  NEXT_PUBLIC_DEMO_MODE?: string;
  NEXT_PUBLIC_DEMO_CLOCK_START?: string;
  NEXT_PUBLIC_DEMO_CLOCK_ANCHOR?: string;
}

/**
 * The offset-computation logic alone, exported for tests -- real code always
 * calls it with `process.env`. Each var is read under its own name (the
 * server always has it, real env vars) with a `NEXT_PUBLIC_`-prefixed
 * fallback -- `next build` uses Turbopack by default (Next 16), and
 * Turbopack does not inline next.config.ts's legacy `env` key into client
 * bundles the way webpack's DefinePlugin did, silently leaving every
 * `"use client"` call to now()/today() reading real, unoffset browser time
 * (NEXT_PUBLIC_-prefixed vars are the one inlining mechanism guaranteed to
 * work under either bundler -- next.config.ts derives them from the same,
 * unrenamed env vars, so no deployment config changes).
 */
export function computeClockOffsetMs(env: ClockEnv, realNowMs: number): number {
  const demoMode = env.DEMO_MODE ?? env.NEXT_PUBLIC_DEMO_MODE;
  const isDemoMode = demoMode === "true";
  if (env.NODE_ENV === "production" && !isDemoMode) return 0;
  const start = env.DEMO_CLOCK_START ?? env.NEXT_PUBLIC_DEMO_CLOCK_START;
  if (!start) return 0;
  const startMs = new Date(start).getTime();
  if (Number.isNaN(startMs)) return 0;

  const anchor = env.DEMO_CLOCK_ANCHOR ?? env.NEXT_PUBLIC_DEMO_CLOCK_ANCHOR;
  if (anchor) {
    const anchorMs = new Date(anchor).getTime();
    if (!Number.isNaN(anchorMs)) return startMs - anchorMs;
  }
  return startMs - realNowMs;
}

// Each property read as its own literal `process.env.X` expression, not a
// bare `process.env` reference -- bundler env inlining (webpack's
// DefinePlugin, Turbopack's own equivalent) only ever rewrites an exact
// `process.env.SOME_NAME` access it can see statically in the source; a
// whole object handed to a function can't be substituted this way and
// silently evaluates to `undefined` properties in the browser (where
// `process.env` is a bundler-provided shim, not Node's real one).
const clockOffsetMs = computeClockOffsetMs(
  {
    NODE_ENV: process.env.NODE_ENV,
    DEMO_MODE: process.env.DEMO_MODE,
    DEMO_CLOCK_START: process.env.DEMO_CLOCK_START,
    DEMO_CLOCK_ANCHOR: process.env.DEMO_CLOCK_ANCHOR,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    NEXT_PUBLIC_DEMO_CLOCK_START: process.env.NEXT_PUBLIC_DEMO_CLOCK_START,
    NEXT_PUBLIC_DEMO_CLOCK_ANCHOR: process.env.NEXT_PUBLIC_DEMO_CLOCK_ANCHOR,
  },
  Date.now(),
);

/** The current instant, offset by DEMO_CLOCK_START outside production. */
export function now(): Date {
  return new Date(Date.now() + clockOffsetMs);
}

function partsInTimeZone(date: Date, timeZone: string): LocalDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Today's date in APP_TIMEZONE. */
export function today(): LocalDate {
  return partsInTimeZone(now(), APP_TIMEZONE);
}

function toUtcMidnight(date: LocalDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcMidnight(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const dt = toUtcMidnight(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtcMidnight(dt);
}

/**
 * Business days (Monday to Friday, no holiday calendar) elapsed from `from`
 * to `to`. Positive when `to` is after `from`, negative when before, 0 when
 * equal or when the gap holds no weekdays.
 */
export function businessDaysBetween(from: LocalDate, to: LocalDate): number {
  const fromMs = toUtcMidnight(from).getTime();
  const toMs = toUtcMidnight(to).getTime();
  if (fromMs === toMs) return 0;
  const sign = toMs > fromMs ? 1 : -1;
  const dayMs = 24 * 60 * 60 * 1000;
  let count = 0;
  let cursor = fromMs;
  while (cursor !== toMs) {
    cursor += sign * dayMs;
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += sign;
  }
  return count;
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Display format "02 Oct 2026" (brief 5.1.9). */
export function formatDate(date: LocalDate): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(day).padStart(2, "0")} ${SHORT_MONTHS[month - 1]} ${year}`;
}

/** A Prisma @db.Date value (UTC midnight) as a LocalDate string. */
export function toLocalDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** Calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / dayMs);
}
