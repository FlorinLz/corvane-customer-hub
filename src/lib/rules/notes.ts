import type { LocalDate } from "@/lib/dates";

/**
 * Brief 3.4.2 "Note / Action items", M10 AC2, AC3: due date today or
 * later at creation; all three fields required once a row is started.
 * The UI enforces "started row" itself (disables Save until every row
 * with any field filled in has all three) — this is the one additional
 * rule that still needs checking once a row is complete.
 */
export function isDueDateValidAtCreation(dueDate: LocalDate, today: LocalDate): boolean {
  return dueDate >= today;
}
