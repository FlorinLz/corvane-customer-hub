import { effectiveTimeZone as effectiveTimeZoneFromCalendar, zonedInstant } from "@/lib/business-hours";
import { APP_TIMEZONE, now as demoNow } from "@/lib/dates";

// Brief 4.9.1, 3.3.6 TZ_ABBREVIATIONS. Pure, shared by client and server.
export const effectiveTimeZone = effectiveTimeZoneFromCalendar;

/**
 * The UTC instant for wall-clock `time` ("HH:MM") on `date` ("YYYY-MM-DD")
 * read in `zone` -- the inverse of `splitInZone` below.
 *
 * Never use `new Date(`${date}T${time}`)` for a date/time form field:
 * with no offset in the string, the Date constructor parses the numbers
 * in whatever zone the *host running the code* happens to be in (ECMA-262)
 * -- the browser's own system zone client-side, which is only ever the
 * viewer's configured zone by coincidence (milestone 8 live fix: a viewer
 * whose browser/OS zone differs from their configured zone got every
 * typed or prefilled time silently shifted by the difference between the
 * two, producing wrong validation errors with no visible cause).
 *
 * Re-exports business-hours.ts's own `zonedInstant` (DST-correct via the
 * installed `@date-fns/tz`) under the name this module's callers reach
 * for, rather than a second implementation.
 */
export const zonedDateTimeToUtc = zonedInstant;

/** [standard, summer | null]. A zone with no DST (MYT, SGT) has a null summer form. */
const TZ_ABBREVIATIONS: Record<string, [string, string | null]> = {
  "Europe/Amsterdam": ["CET", "CEST"],
  "Europe/Rome": ["CET", "CEST"],
  "Europe/Berlin": ["CET", "CEST"],
  "Europe/Paris": ["CET", "CEST"],
  "Europe/Madrid": ["CET", "CEST"],
  "Europe/Brussels": ["CET", "CEST"],
  "Europe/Vienna": ["CET", "CEST"],
  "Europe/Prague": ["CET", "CEST"],
  "Europe/London": ["GMT", "BST"],
  "Europe/Lisbon": ["WET", "WEST"],
  "Europe/Helsinki": ["EET", "EEST"],
  "Europe/Dublin": ["GMT", "IST"],
  "Asia/Kuala_Lumpur": ["MYT", null],
  "Asia/Singapore": ["SGT", null],
  "America/New_York": ["EST", "EDT"],
};

function offsetMinutesAt(instant: Date, zone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
  const part = fmt.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** UTC+HH:MM fallback for a zone not in TZ_ABBREVIATIONS (brief: "UTC+03:00" for Europe/Bucharest). */
function offsetFallback(instant: Date, zone: string): string {
  const total = offsetMinutesAt(instant, zone);
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/**
 * Standard or summer form by the zone's UTC offset at `instant` (brief
 * 3.3.6): a January instant of the same year is never in DST, so
 * comparing against it tells standard from summer without hardcoding
 * DST calendar rules per zone.
 */
export function tzAbbreviation(instant: Date, zone: string): string {
  const known = TZ_ABBREVIATIONS[zone];
  if (!known) return offsetFallback(instant, zone);
  const [standard, summer] = known;
  if (!summer) return standard;
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric" }).format(instant));
  const winterRef = new Date(Date.UTC(year, 0, 15)); // 15 Jan: never in DST, either hemisphere's summer zones aren't in this table
  return offsetMinutesAt(instant, zone) === offsetMinutesAt(winterRef, zone) ? standard : summer;
}

/** "America/New_York" -> "New York" (brief M21 AC10's "outside business hours (04:10 in New York)"). */
export function zoneCity(zone: string): string {
  return zone.split("/").pop()!.replace(/_/g, " ");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; // "Sep", never the platform's "Sept"

/**
 * The one date-time format of the app: "Mon 05 Oct, 16:48 MYT", or just "16:48 MYT" with `timeOnly`. The year is added
 * ("Mon 05 Oct 2027, 16:48 MYT") only when it differs from the year of `now` (default: the demo clock), both read in `zone`.
 * The abbreviation always comes from `tzAbbreviation`, not from the platform's own (locale- and zone-inconsistent) timeZoneName.
 */
export function formatInZone(instant: Date, zone: string, opts: { timeOnly?: boolean; now?: Date } = {}): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "short",
      day: "2-digit",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
  const parts = fmt(instant);
  const get = (type: string, ps = parts) => ps.find((p) => p.type === type)?.value ?? "";
  const time = `${get("hour")}:${get("minute")} ${tzAbbreviation(instant, zone)}`;
  if (opts.timeOnly) return time;
  const year = get("year");
  const currentYear = get("year", fmt(opts.now ?? demoNow()));
  return `${get("weekday")} ${get("day")} ${MONTHS[Number(get("month")) - 1]}${year !== currentYear ? ` ${year}` : ""}, ${time}`;
}

/** `formatInZone` in the app's own zone, for server-rendered records with no viewer zone at hand (History, audit, GLEIF checks): "Fri 02 Oct, 10:05 UTC+03:00". */
export function formatDateTime(instant: Date, zone: string = APP_TIMEZONE): string {
  return formatInZone(instant, zone);
}

/**
 * Splits an instant into the "YYYY-MM-DD" / "HH:MM" pair an
 * `<input type="date">` + `<input type="time">` pair expects, read in
 * `zone` -- for prefilling a form field from a server instant (e.g.
 * `now()`) in the *viewer's* zone, not the browser's own (milestone 8
 * live fix: the browser's zone is not the viewer's configured zone, and
 * reading a Date's own getFullYear()/getHours() etc. always uses the
 * browser's zone, silently wrong whenever the two differ).
 */
export function splitInZone(instant: Date, zone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
