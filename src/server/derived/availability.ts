// Brief 5.1 M7 edge cases 1-2 / rules/availability.test.ts. "Available
// now" for 24/7; a Mon-Fri window outside those hours in the contact's
// time zone is "Outside availability"; windows may cross midnight.
export interface AvailabilityInput {
  timeZone: string;
  available24x7: boolean;
  availabilityDays: number[]; // ISO weekday 1=Mon..7=Sun
  availabilityStart: string | null; // "HH:MM"
  availabilityEnd: string | null; // "HH:MM"
  now: Date;
}

export interface AvailabilityResult {
  localTime: string; // "HH:MM"
  localWeekday: number; // ISO 1-7
  isAvailableNow: boolean;
  hasWindow: boolean;
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(input.now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const WEEKDAY_MAP: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const localWeekday = WEEKDAY_MAP[weekdayShort] ?? 1;
  const localTime = `${hour}:${minute}`;

  if (input.available24x7) {
    return { localTime, localWeekday, isAvailableNow: true, hasWindow: true };
  }

  if (!input.availabilityStart || !input.availabilityEnd || input.availabilityDays.length === 0) {
    return { localTime, localWeekday, isAvailableNow: false, hasWindow: false };
  }

  const nowMin = minutesOfDay(localTime);
  const startMin = minutesOfDay(input.availabilityStart);
  const endMin = minutesOfDay(input.availabilityEnd);
  const crossesMidnight = endMin <= startMin;

  let isAvailableNow: boolean;
  if (!crossesMidnight) {
    isAvailableNow = input.availabilityDays.includes(localWeekday) && nowMin >= startMin && nowMin < endMin;
  } else {
    // Window spans midnight: available either from start-to-midnight on a
    // listed day, or midnight-to-end on the day after a listed day.
    const yesterday = localWeekday === 1 ? 7 : localWeekday - 1;
    const inEveningPart = input.availabilityDays.includes(localWeekday) && nowMin >= startMin;
    const inMorningPart = input.availabilityDays.includes(yesterday) && nowMin < endMin;
    isAvailableNow = inEveningPart || inMorningPart;
  }

  return { localTime, localWeekday, isAvailableNow, hasWindow: true };
}
