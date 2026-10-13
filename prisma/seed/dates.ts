import { addDays, today, type LocalDate } from "@/lib/dates";

const TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Bucharest";

function timeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

function zonedTimeToUtc(date: LocalDate, time: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMinutes = timeZoneOffsetMinutes(timeZone, new Date(naiveUtcMs));
  return new Date(naiveUtcMs - offsetMinutes * 60_000);
}

/** A date-only value, `offsetDays` calendar days from today() (brief 7.1.0). */
export function d(offsetDays: number): LocalDate {
  return addDays(today(), offsetDays);
}

/** A timestamp at `time` (default "10:00") Europe/Bucharest on d(offsetDays), stored as a UTC Date. */
export function ts(offsetDays: number, time = "10:00"): Date {
  return zonedTimeToUtc(d(offsetDays), time, TIME_ZONE);
}

function weekdayOf(date: LocalDate): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 Sunday ... 6 Saturday
}

/** d(offsetDays), moved back to the Friday before when it falls on a Saturday or Sunday (brief 7.1.17 "wd"). */
export function wd(offsetDays: number): LocalDate {
  const date = d(offsetDays);
  const weekday = weekdayOf(date);
  if (weekday === 0) return addDays(date, -2);
  if (weekday === 6) return addDays(date, -1);
  return date;
}

/** The instant at `time` in `timeZone` on d(offsetDays), stored as a UTC Date (brief 7.1.17 "tsz"). */
export function tsz(offsetDays: number, time: string, timeZone: string): Date {
  return zonedTimeToUtc(d(offsetDays), time, timeZone);
}

/** `tsz` on `wd(offsetDays)` (brief 7.1.17 "wtsz"). */
export function wtsz(offsetDays: number, time: string, timeZone: string): Date {
  return zonedTimeToUtc(wd(offsetDays), time, timeZone);
}
