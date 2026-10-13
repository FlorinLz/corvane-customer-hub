/**
 * A linked issue's stored description starts with a pointer to its partner issue:
 * "Linked to ISS-1043: Lloyds Bank plc UK CoP / GB partner issue.\n\n<the partner issue's description>".
 * The issue page and Home show the description without it (the "Linked issue" row and "Linked to" line already say so).
 */
export function stripLinkedPrefix(description: string): string {
  return description.replace(/^Linked to ISS-\d+:[^\n]*\n\n/, "");
}

/** The first non-empty line of a description, for one-line places. */
export function firstLine(description: string): string {
  return stripLinkedPrefix(description).split("\n").find((l) => l.trim() !== "")?.trim() ?? "";
}
