import { now } from "@/lib/dates";
import { splitInZone } from "@/lib/time-zones";

// "Sent on" / "Time" in the Record report sent and Close dialogs. The form takes minutes.

const floorMinute = (d: Date) => new Date(Math.floor(d.getTime() / 60_000) * 60_000);

/**
 * "Now" for a dialog's checks: the demo clock read when the dialog is used, never earlier than the resolution. The resolution has
 * happened, so "now" cannot be before it; a browser clock that lags (its offset is taken when the page loads) cannot make a time at or
 * after the resolution look like the future, nor one before it look valid.
 */
export function dialogNow(resolvedAt: Date | null): Date {
  return resolvedAt && resolvedAt > now() ? resolvedAt : now();
}

/** The date and time a dialog prefills when it opens: now, to the minute, and never earlier than the resolution minute. */
export function openingTime(resolvedAt: Date | null, zone: string): { date: string; time: string } {
  const at = floorMinute(dialogNow(resolvedAt));
  return splitInZone(at, zone);
}
