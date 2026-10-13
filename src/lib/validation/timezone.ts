// Brief 3.3.4 `TIME_ZONES`: "Intl.supportedValuesOf('timeZone') plus
// UTC" — the runtime's own tz database doesn't include the bare "UTC"
// alias itself (only IANA zones like "Etc/UTC"), so it's appended
// explicitly, same as the brief's constant definition.
export const TIME_ZONES: readonly string[] = [...Intl.supportedValuesOf("timeZone"), "UTC"];

const TIME_ZONE_SET = new Set(TIME_ZONES);

export const isValidTimeZone = (tz: string): boolean => TIME_ZONE_SET.has(tz);
