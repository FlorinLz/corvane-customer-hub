import { TZDate } from "@date-fns/tz";
import type { Team } from "@prisma/client";

// Brief 4.9.3. Calendars, isInBusinessHours, nextBusinessStart,
// addBusinessMinutes, businessMinutesBetween. Pure, shared by client and
// server: no DB import. Business hours are fixed in R1 (09:00-18:00,
// Monday to Friday, no holiday calendar, B17) — the TeamBusinessHours
// table exists for data completeness (decision B37, migration 0003) and
// is seeded with these exact values, but editing them in the portal is
// out of scope this release, so this module uses the static mirror
// below rather than a DB read, keeping it genuinely pure and testable
// from the client (the report form imports it too, from milestone 6B).
export type Calendar = { timeZone: string; start: string; end: string; weekdays: number[] };

const BUSINESS_START = "09:00";
const BUSINESS_END = "18:00";
const BUSINESS_WEEKDAYS = [1, 2, 3, 4, 5];

/** Brief 3.3.6 TEAM_TIME_ZONES: mirrors the seeded TeamBusinessHours rows. */
export const TEAM_TIME_ZONES: Partial<Record<Team, string>> = {
  OPS: "Asia/Kuala_Lumpur",
  NETWORK: "Asia/Singapore",
  COMPLIANCE: "Asia/Singapore",
  FINANCE: "Asia/Singapore",
  // SALES, CS: null -> each user's own time zone.
};

export const effectiveTimeZone = (u: { timeZone: string; team: Team }): string => TEAM_TIME_ZONES[u.team] ?? u.timeZone;

/**
 * OPS, NETWORK, COMPLIANCE, FINANCE: the team's own time zone.
 * SALES, CS: the person's own time zone (owner team Sales: the named
 * Sales person) -- `person` must be given for these two teams.
 */
export function teamCalendar(team: Team, person?: { timeZone: string; team: Team } | null): Calendar {
  const timeZone = TEAM_TIME_ZONES[team] ?? person?.timeZone ?? "Europe/Bucharest";
  return { timeZone, start: BUSINESS_START, end: BUSINESS_END, weekdays: BUSINESS_WEEKDAYS };
}

export const userCalendar = (u: { timeZone: string; team: Team }): Calendar => teamCalendar(u.team, u);

/** "YYYY-MM-DD" of `instant` in `zone`. */
function localDateIn(instant: Date, zone: string): string {
  let f = dateFormats.get(zone);
  if (!f) dateFormats.set(zone, (f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })));
  return f.format(instant);
}

/** One formatter per zone: building one is far slower than formatting with it, and Home does thousands of these. */
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** ISO weekday (1 = Monday ... 7 = Sunday) of a plain "YYYY-MM-DD" calendar date. */
function isoWeekdayOfDate(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

/** The instant at local time `time` ("HH:MM") on `localDate` ("YYYY-MM-DD") in `zone`. DST-correct. */
export function zonedInstant(localDate: string, time: string, zone: string): Date {
  const [y, m, d] = localDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new TZDate(y, m - 1, d, hh, mm, 0, zone);
}

function addDaysToLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** One window per local calendar date, converted on that date: DST changes need no special case. */
function windowOn(localDate: string, cal: Calendar): { start: Date; end: Date } {
  return { start: zonedInstant(localDate, cal.start, cal.timeZone), end: zonedInstant(localDate, cal.end, cal.timeZone) };
}

/** 09:00:00 inside, 18:00:00 outside (brief 4.9.2 "Boundaries", M18 edge case 1). */
export function isInBusinessHours(t: Date, cal: Calendar): boolean {
  const d = localDateIn(t, cal.timeZone);
  if (!cal.weekdays.includes(isoWeekdayOfDate(d))) return false;
  const w = windowOn(d, cal);
  return t >= w.start && t < w.end;
}

/** `t` itself when already inside business hours. */
export function nextBusinessStart(t: Date, cal: Calendar): Date {
  if (isInBusinessHours(t, cal)) return t;
  let d = localDateIn(t, cal.timeZone);
  for (let i = 0; i < 8; i++, d = addDaysToLocalDate(d, 1)) {
    if (!cal.weekdays.includes(isoWeekdayOfDate(d))) continue;
    const w = windowOn(d, cal);
    if (w.start > t) return w.start;
  }
  throw new Error("calendar has no business day");
}

export function addBusinessMinutes(t: Date, minutes: number, cal: Calendar): Date {
  let cur = nextBusinessStart(t, cal);
  let left = minutes;
  for (;;) {
    const w = windowOn(localDateIn(cur, cal.timeZone), cal);
    const room = (w.end.getTime() - cur.getTime()) / 60_000;
    if (left <= room) return new Date(cur.getTime() + left * 60_000); // may end exactly at 18:00
    left -= room;
    cur = nextBusinessStart(w.end, cal);
  }
}

/** Business minutes of overlap between [from, to) and `cal`'s windows. 0 when `to` is not after `from`. */
export function businessMinutesBetween(from: Date, to: Date, cal: Calendar): number {
  if (to <= from) return 0;
  let cur = nextBusinessStart(from, cal);
  let total = 0;
  while (cur < to) {
    const w = windowOn(localDateIn(cur, cal.timeZone), cal);
    const windowEnd = w.end < to ? w.end : to;
    if (windowEnd > cur) total += (windowEnd.getTime() - cur.getTime()) / 60_000;
    cur = nextBusinessStart(w.end, cal);
  }
  return Math.round(total);
}
