"use client";

import Link from "next/link";

import type { Severity } from "@prisma/client";

import { SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { phraseFor, timeLeft } from "@/lib/time-block";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TimeBlock } from "@/components/issues/TimeBlock";
import type { RoleLine, RowView } from "@/server/queries/worklist/issues";
import { WhyThis } from "@/components/onboarding/WhyThis";

function severityVariant(s: string): "danger" | "due" | "neutral-outline" {
  if (s === "SEV1") return "danger";
  if (s === "SEV2") return "due";
  return "neutral-outline";
}

/** A legal name that wraps at spaces but never inside its last two words ("Bank plc", "Totta, S.A."). */
function nameWithSuffixGlued(name: string): string {
  const i = name.lastIndexOf(" ");
  const j = i > 0 ? name.lastIndexOf(" ", i - 1) : -1;
  return j > 0 ? `${name.slice(0, j)} ${name.slice(j + 1, i)}\u00a0${name.slice(i + 1)}` : name;
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/** One context line: "Compliance: Mei Chen, assess in 56 min". The phrase is a marker (dot and text) only when overdue or due within 1 h. */
function contextText(line: RoleLine, now: Date): { text: string; phrase: { text: string; marker: "over" | "soon" | null } | null } {
  const phrase = phraseFor(line.dueAt ? new Date(line.dueAt) : null, now);
  return { text: `${line.role}: ${line.person}, ${lowerFirst(line.label)}`, phrase };
}

/** The table's header row: five columns, four below 1100 px. */
export function IssueTableHeader() {
  return (
    <div
      role="row"
      className={cn(
        "grid grid-cols-[132px_162px_minmax(0,11fr)_minmax(0,10fr)] gap-x-4 border-t border-border bg-tint px-4 py-2 text-meta font-medium text-text-secondary",
        "min-[1101px]:grid-cols-[150px_170px_minmax(0,30fr)_200px_minmax(0,35fr)] min-[1101px]:gap-x-5",
      )}
    >
      <span>Issue</span>
      <span className="inline-flex items-center gap-1" data-onboarding="time-column">
        Time
        <WhyThis note="time-column" />
      </span>
      <span className="min-[1101px]:hidden">Description and customer</span>
      <span className="hidden min-[1101px]:inline">Description</span>
      <span className="hidden min-[1101px]:inline">Customer</span>
      <span>Next actions</span>
    </div>
  );
}

/**
 * One Home issue row, a table row: Issue | Time | Description | Customer | Next actions.
 * The whole row is the link to the issue. Mine: the time block is the viewer's own deadline only; My team: the most urgent open
 * action, whoever owns it. At 1100 px and below, Description and Customer merge into one column.
 */
export function IssueRow({
  issueId,
  number,
  severity,
  view,
  now,
  zone,
}: {
  issueId: string;
  number: number;
  severity: string;
  view: RowView;
  now: Date;
  zone: string;
}) {
  const dueAt = view.timeDueAt ? new Date(view.timeDueAt) : null;
  const left = timeLeft(dueAt, now);
  // Accent bar: only for a deadline that is overdue or under an hour away.
  // A Resolved or Closed row is not urgent: no accent bar, no red time, a muted Sev badge.
  const finished = view.statusNote !== null;
  const accent = finished ? "" : left.state === "over" ? "shadow-[inset_4px_0_0_var(--color-danger)]" : left.state === "soon" ? "shadow-[inset_4px_0_0_var(--color-due-soon)]" : "";
  const note = view.scope === "team" ? view.timePerson : dueAt ? null : "for you";

  const context = view.line2.slice(0, 2).map((l) => ({ line: l, ...contextText(l, now) }));
  const line1Text =
    view.line1.kind === "own"
      ? view.line1.label
      : view.line1.kind === "waiting"
        ? `Waiting on ${view.line1.person} (${view.line1.role}): ${view.line1.label}`
        : view.line1.kind === "person"
          ? `${view.line1.person}: ${view.line1.label}`
          : "No open actions";
  // Full text on hover: every action of the row, not only the two context lines that fit.
  const fullText = [line1Text, ...view.line2.map((l) => { const c = contextText(l, now); return `${c.text}${c.phrase ? ` ${c.phrase.text}` : ""}`; })].join("\n");

  return (
    <Link
      href={`/issues/${issueId}`}
      data-testid={`issue-row-${issueId}`}
      data-onboarding="issue-row"
      data-onboarding-issue={issueId}
      className={cn(
        "grid grid-cols-[132px_162px_minmax(0,11fr)_minmax(0,10fr)] items-start gap-x-4 border-t border-border px-4 py-[14px] text-text hover:bg-tint",
        "min-[1101px]:grid-cols-[150px_170px_minmax(0,30fr)_200px_minmax(0,35fr)] min-[1101px]:gap-x-5",
        accent,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-meta leading-5 text-text-secondary">{issueDisplayId(number)}</span>
          <Badge variant={finished ? "neutral-outline" : severityVariant(severity)} className={finished ? "opacity-70" : undefined}>{SEVERITY_LABELS[severity as Severity]}</Badge>
        </span>
        {view.statusNote && (
          <Badge variant={view.statusNote === "Resolved" ? "success" : "neutral-outline"} className="self-start">
            {view.statusNote}
          </Badge>
        )}
        {view.linkedTo && <span className="text-meta text-text-secondary">Linked to {view.linkedTo}</span>}
      </div>

      <TimeBlock dueAt={dueAt} now={now} zone={zone} note={note} dateOnly={view.timeDateOnly} compact muted={finished} testId={`time-block-${issueId}`} />

      {/* Wide: Description and Customer are two columns. */}
      <div className="hidden min-w-0 text-body min-[1101px]:block" data-testid={`desc-${issueId}`} title={`${view.typeLabel}\n${view.descriptionLine}`}>
        <span className="block truncate font-semibold">{view.typeLabel}</span>
        <span className="block truncate text-text-secondary">{view.descriptionLine}</span>
      </div>
      <div className="hidden min-w-0 text-body min-[1101px]:block" title={`${view.entityName}${view.isPartner ? " (Partner)" : ""}${view.productLine ? `\n${view.productLine}` : ""}`}>
        <span className="line-clamp-2 break-words" data-testid={`customer-${issueId}`}>{nameWithSuffixGlued(view.entityName)}</span>
        {(view.isPartner || view.productLine) && (
          <span className="flex min-w-0 items-center gap-2 text-meta text-text-secondary">
            {view.isPartner && <span className="shrink-0 rounded-pill border border-border px-1.5 text-chip">Partner</span>}
            {view.productLine && <span className="truncate">{view.productLine}</span>}
          </span>
        )}
      </div>
      {/* Narrow: one merged column. */}
      <div className="min-w-0 text-body min-[1101px]:hidden" title={`${view.typeLabel}: ${view.descriptionLine}\n${view.entityName}${view.productLine ? ` · ${view.productLine}` : ""}`}>
        <span className="block truncate">
          <span className="font-semibold">{view.typeLabel}</span>
          <span className="text-text-secondary"> · {view.descriptionLine}</span>
        </span>
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-meta text-text-secondary">
          <span className="break-words text-text">{nameWithSuffixGlued(view.entityName)}</span>
          {view.isPartner && <span className="shrink-0 rounded-pill border border-border px-1.5 text-chip">Partner</span>}
          {view.productLine && <span>{view.productLine}</span>}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-0.5" title={fullText}>
        <span
          className={cn(
            "flex min-w-0 items-center",
            view.line1.kind === "own" || view.line1.kind === "person" ? "text-[16px] font-semibold leading-6" : "text-body font-normal text-text-secondary",
          )}
        >
          {view.line1.kind === "own" && <Badge variant="brand" className="mr-2 shrink-0">You</Badge>}
          <span data-testid={`line1-${issueId}`} className="truncate">{line1Text}</span>
        </span>
        {context.length > 0 && (
          <span data-testid={`line2-${issueId}`} className="flex min-w-0 flex-col text-meta text-text-secondary">
            {context.map(({ line, text, phrase }, i) => (
              <span key={`${line.role}-${line.person}-${i}`} className="flex min-w-0 items-baseline gap-1" title={`${text}${phrase ? ` ${phrase.text}` : ""}`}>
                <span className="min-w-0 truncate">{text}</span>
                {phrase && (
                  <span className="shrink-0 whitespace-nowrap">
                    {phrase.marker && !finished ? (
                      <span className={cn("inline-flex items-center gap-1 font-semibold", phrase.marker === "over" ? "text-danger" : "text-due")}>
                        <i aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />
                        {phrase.text}
                      </span>
                    ) : (
                      phrase.text
                    )}
                  </span>
                )}
              </span>
            ))}
          </span>
        )}
      </div>
    </Link>
  );
}
