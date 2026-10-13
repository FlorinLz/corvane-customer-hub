import { formatInZone, splitInZone } from "@/lib/time-zones";

// Role actions. Pure
// formatting shared by the Home issue row and the Issue page's "Who does
// what" block; both feed it the server demo clock (a ticking copy of
// `serverNow`, never the browser's own clock) and the viewer's own zone.

export type TimeState = "over" | "soon" | "default" | "none";

export interface TimeLeft {
  /** "12 min", "6 h 58 min", "2 days", "Overdue 5 min", "No deadline". */
  text: string;
  state: TimeState;
  /** Signed whole minutes until the deadline, or null when there is none. Negative once overdue. */
  minutes: number | null;
}

/** under 1 h "58 min"; 1 h to 24 h "7 h" / "6 h 58 min"; from 24 h "2 days". Whole minutes in, already rounded. */
export function spanText(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return `${m} min`;
  if (m < 24 * 60) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
  }
  const days = Math.floor(m / (24 * 60));
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Time left until `dueAt`. A deadline already passed by a minute or more is
 * "over" and always says "Overdue"; under an hour (including the minute
 * either side of zero, which reads "Due now") is "soon"; no deadline is "none".
 */
export function timeLeft(dueAt: Date | null, now: Date): TimeLeft {
  if (!dueAt) return { text: "No deadline", state: "none", minutes: null };
  const ms = dueAt.getTime() - now.getTime();
  if (ms <= -60_000) {
    const minutes = Math.floor(ms / 60_000);
    return { text: `Overdue ${spanText(-ms / 60_000)}`, state: "over", minutes };
  }
  if (ms <= 0) return { text: "Due now", state: "soon", minutes: 0 };
  const minutes = Math.ceil(ms / 60_000);
  return { text: spanText(minutes), state: minutes < 60 ? "soon" : "default", minutes };
}

/** The calendar day of `at` in `zone` as "Tue 06 Oct"; with the year ("Tue 06 Oct 2027") only when it is not the year of `now`. */
export function dayText(at: Date, now: Date, zone: string): string {
  return formatInZone(at, zone, { now }).replace(/,\s.*$/, "");
}

/**
 * When something happens or happened, in the viewer's zone, always with the zone label: "10:43 CEST" on the
 * viewer's own day, "Tue 06 Oct, 00:48 MYT" on another day (weekday, day, month, time, zone).
 */
export function dayTimeText(at: Date, now: Date, zone: string): string {
  const time = formatInZone(at, zone, { timeOnly: true });
  return splitInZone(at, zone).date === splitInZone(now, zone).date ? time : `${dayText(at, now, zone)}, ${time}`;
}

/** A Timeline value: always the day, then the time and zone label: "Mon 05 Oct, 09:40 MYT" (the year only when it is not the year of `now`). */
export function timelineText(at: Date, now: Date, zone: string): string {
  return formatInZone(at, zone, { now });
}

/** A Done line's time: always the day, then the time and zone label: "Mon 05 Oct, 17:20 SGT" (the shared formatter). */
export function doneTimeText(at: Date, zone: string, now?: Date): string {
  return formatInZone(at, zone, { now });
}

/** "by 10:43 CEST" / "by Tue 06 Oct, 00:48 MYT". */
export function byText(dueAt: Date, now: Date, zone: string): string {
  return `by ${dayTimeText(dueAt, now, zone)}`;
}

/** A deadline that is a calendar date, not a time of day (the root cause report): "by Mon 19 Oct", no zone label. */
export function byDateText(dueAt: Date, now: Date, zone: string): string {
  return `by ${dayText(dueAt, now, zone)}`;
}

/** Line 2 phrase for somebody else's deadline: "in 58 min", "Overdue 5 min", or null with no deadline. */
export function phraseFor(dueAt: Date | null, now: Date): { text: string; marker: "over" | "soon" | null } | null {
  if (!dueAt) return null;
  const left = timeLeft(dueAt, now);
  if (left.state === "over") return { text: left.text, marker: "over" };
  if (left.state === "soon") return { text: left.text === "Due now" ? "due now" : `in ${left.text}`, marker: "soon" };
  return { text: `in ${left.text}`, marker: null };
}
