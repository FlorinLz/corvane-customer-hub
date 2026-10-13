// Brief 3.4.2 Contact/Availability. A pure shape check: "24/7", or at
// least 1 weekday with a start and end time that differ (crossing
// midnight is allowed — that's a derived-availability concern, not a
// validation failure).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type AvailabilityInput =
  | { available24x7: true }
  | { available24x7: false; days: number[]; start: string; end: string };

export function isValidAvailability(v: AvailabilityInput): boolean {
  if (v.available24x7) return true;
  if (v.days.length === 0) return false;
  if (!v.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) return false;
  if (!TIME_RE.test(v.start) || !TIME_RE.test(v.end)) return false;
  return v.start !== v.end;
}
