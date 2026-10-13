import { byDateText, byText, timeLeft } from "@/lib/time-block";
import { cn } from "@/lib/utils";

/**
 * The role-actions time block: the time left, large,
 * and the exact deadline under it, in the viewer's own zone and always with
 * the zone label. `now` is the server demo clock (ticked in the browser),
 * never the browser's own clock.
 *
 * States: over (danger; in the Home table "Overdue" is its own small line above the duration, elsewhere it reads "Overdue 5 min"),
 * soon (under 1 h), default, none (no deadline, or nothing for this viewer to do).
 * The cell never overflows: it has min-width 0 and its text wraps.
 */
export function TimeBlock({
  dueAt,
  now,
  zone,
  note,
  className,
  testId,
  dateOnly,
  compact,
  muted,
}: {
  dueAt: Date | null;
  now: Date;
  zone: string;
  /** Small line when there is no deadline ("for you", "until resolved"), or the person under the time (My team). */
  note?: string | null;
  className?: string;
  testId?: string;
  /** The deadline is a calendar date (root cause report): "by Mon 19 Oct", no zone label. */
  dateOnly?: boolean;
  /** Home table: more than 24 h away reads in regular weight and secondary colour; "No deadline" is 14 px. */
  compact?: boolean;
  /** A Resolved or Closed row: no red, no amber, the time reads as plain secondary text. */
  muted?: boolean;
}) {
  const left = timeLeft(dueAt, now);
  const small = dueAt ? [note, dateOnly ? byDateText(dueAt, now, zone) : byText(dueAt, now, zone)].filter(Boolean).join(" · ") : (note ?? "");
  const state = muted && (left.state === "over" || left.state === "soon") ? "muted" : left.state;

  // Home table, no deadline for the viewer: a muted dash; the explanation is the tooltip (the words stay for screen readers).
  if (compact && left.state === "none" && (!note || note === "for you")) {
    return (
      <div data-testid={testId} data-state="none" className={cn("flex min-w-0 flex-col", className)} title="No deadline for you on this issue">
        <span aria-hidden="true" className="text-body text-text-secondary">&ndash;</span>
        <span className="sr-only">No deadline for you</span>
      </div>
    );
  }

  // Under 24 h: large and bold. From 24 h: regular weight, with the date underneath (the small line).
  const long = left.state === "default" && left.minutes !== null && left.minutes >= 24 * 60;
  const big = cn(
    "min-w-0 break-words font-semibold",
    left.state === "none"
      ? compact
        ? "text-body font-normal text-text-secondary"
        : "text-[16px] leading-6 text-text-secondary"
      : long
        ? compact
          ? "text-body font-normal text-text-secondary"
          : "text-[16px] font-normal leading-6 text-text"
        : "text-[22px] leading-7",
    state === "over" && "text-danger",
    state === "soon" && "text-due",
    state === "muted" && "font-normal text-text-secondary",
    left.state === "default" && !long && "text-primary",
  );
  // Outside the Home table the time reads as a phrase, like line 2 of a Home row: "in 58 min", "in 2 h 10 min", "Overdue 5 min".
  // A long overdue time wraps after "Overdue", never inside "3 h 28 min" (non-breaking spaces in the duration).
  const text =
    !compact && left.state === "over"
      ? `Overdue ${left.text.replace(/^Overdue /, "").replace(/ /g, "\u00a0")}`
      : !compact && (left.state === "default" || (left.state === "soon" && left.text !== "Due now"))
        ? `in ${left.text}`
        : left.text;
  return (
    <div data-testid={testId} data-state={left.state} className={cn("flex min-w-0 flex-col", className)}>
      {left.state === "over" && compact ? (
        <>
          <span className={cn("text-meta font-semibold", state === "muted" ? "text-text-secondary" : "text-danger")}>Overdue</span>
          {" "}
          <span className={big}>{left.text.replace(/^Overdue /, "")}</span>
        </>
      ) : (
        <span className={big}>{text}</span>
      )}
      {small && <span className="min-w-0 break-words text-meta text-text-secondary">{small}</span>}
    </div>
  );
}
