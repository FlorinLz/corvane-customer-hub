"use client";

import * as React from "react";
import { CheckCircle2, Clock } from "lucide-react";

import { TEAM_LABELS } from "@/lib/labels";
import { formatInZone } from "@/lib/time-zones";
import { byDateText, dayTimeText, doneTimeText, spanText } from "@/lib/time-block";
import { useTickingNow } from "@/lib/use-ticking-now";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ReportReviewActions } from "@/components/issues/ReportReviewActions";
import { TimeBlock } from "@/components/issues/TimeBlock";
import type { RoleAction } from "@/server/derived/role-actions";
import { WhyThis } from "@/components/onboarding/WhyThis";

/** What the "Record report sent" dialog needs (the root cause report task, M27). */
export interface ReportDialogData {
  entityId: string;
  displayId: string;
  entityName: string;
  resolvedAt: Date | null;
  contacts: { id: string; fullName: string; role: string }[];
  defaultContactId: string | null;
  /** The approved draft the owner sends: the dialog is prefilled with its link and summary. */
  draftLink: string | null;
  draftSummary: string | null;
}

/**
 * One completed step as the audit line reads it: "Acknowledged by Kevin Lim at Sun 04 Oct, 21:21 CEST, 9 min after Corvane became aware
 * (target 15 min, on time)". A late one reads "late by 12 min", with the danger marker. Always the day, then time and zone.
 */
function DoneItem({ action, zone }: { action: RoleAction; zone: string }) {
  const d = action.done!;
  const t = d.timing;
  if (d.report) {
    // "Root cause report sent Mon 05 Oct, 17:20 SGT to Priya Nair by Lukas Brenner (Network)", with the report link.
    return (
      <>
        {d.label} {doneTimeText(d.at, zone)}
        {d.report.to ? ` to ${d.report.to}` : ""}
        {d.byName ? ` by ${d.byName}${d.report.team ? ` (${TEAM_LABELS[d.report.team]})` : ""}` : ""}
        {d.report.url && (
          <>
            {" · "}
            <a href={d.report.url} target="_blank" rel="noopener noreferrer" className="text-link-text hover:underline">
              Root cause report
            </a>
          </>
        )}
      </>
    );
  }
  return (
    <>
      {d.label}
      {d.byName ? ` by ${d.byName}${d.byTeam ? ` (${TEAM_LABELS[d.byTeam]})` : ""}` : ""} at {doneTimeText(d.at, zone)}
      {t && (
        <>
          , {spanText(t.elapsedMinutes)} after {d.since} (target {t.targetText},{" "}
          {t.lateMinutes === null ? (
            "on time"
          ) : (
            <span className="inline-flex items-center gap-1 font-semibold text-danger">
              <i aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />
              late by {spanText(t.lateMinutes)}
            </span>
          )}
          )
        </>
      )}
    </>
  );
}

function Step({ action, n, viewerId, now, zone, approve }: { action: RoleAction; n: number; viewerId: string; now: Date; zone: string; approve: React.ReactNode }) {
  const isMe = action.person.id === viewerId;
  const blocked = action.state === "blocked";
  const note = action.queuedUntil ? `Clocks start ${dayTimeText(action.queuedUntil, now, zone)}` : action.dueAt ? null : (action.afterNote ?? null);
  const sub = [action.subLine ? `${action.subLine}${action.subLineBy ? `, ${byDateText(action.subLineBy, now, zone)}` : ""}` : null, action.onCallUntil ? `On-call until ${dayTimeText(action.onCallUntil, now, zone)}` : null].filter(Boolean).join(". ");

  return (
    <div
      data-testid={`plan-row-${action.key}`}
      data-state={action.state}
      data-me={isMe ? "true" : undefined}
      className={cn(
        "grid grid-cols-[36px_minmax(0,1fr)_190px] items-center gap-x-5 gap-y-1.5 border-t border-border px-5 py-[14px]",
        "min-[1101px]:grid-cols-[36px_minmax(0,1fr)_230px_200px]",
        isMe && "bg-tint-strong shadow-[inset_4px_0_0_var(--color-primary)]",
      )}
    >
      <span
        className={cn(
          "row-span-2 inline-flex size-6 items-center justify-center rounded-full border border-border text-[13px] font-semibold text-text min-[1101px]:row-span-1",
          isMe && "border-primary bg-primary text-white",
        )}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className={cn("col-span-2 min-w-0 min-[1101px]:col-span-1", blocked && "text-text-secondary")}>
        <div className={cn("text-[16px] leading-6", isMe && "font-semibold")}>{action.label}</div>
        {blocked ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-text-secondary">
            <span className="inline-flex h-5 items-center gap-1 rounded-pill border border-border bg-white px-2 text-[12px] font-medium text-text-secondary">
              <Clock className="size-3" aria-hidden="true" />
              Waiting
            </span>
            <span>{action.startsWhen}</span>
          </div>
        ) : null}
        {sub && <div className="text-meta text-text-secondary">{sub}</div>}
        {action.key === "review_report" && action.state === "open" && approve && <div className="mt-2">{approve}</div>}
      </div>
      <div className="col-start-2 flex min-w-0 flex-col min-[1101px]:col-start-auto">
        <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-text-secondary">{action.role}</span>
        <span className="flex items-center gap-2 font-semibold text-text">
          {action.person.name}
          {isMe && <Badge variant="brand">You</Badge>}
        </span>
      </div>
      {blocked && action.dueAt ? (
        <TimeBlock className="col-start-3 min-[1101px]:col-start-auto" dueAt={action.dueAt} now={now} zone={zone} note={null} testId={`plan-time-${action.key}`} dateOnly={action.dateOnly} />
      ) : blocked ? (
        <div data-testid={`plan-time-${action.key}`} data-state="blocked" className="col-start-3 flex min-w-0 flex-col min-[1101px]:col-start-auto">
          <span className="text-[16px] leading-6 text-text-secondary">{action.plannedDays != null ? `${action.plannedDays} days` : "No deadline"}</span>
          {action.afterNote && <span className="text-meta text-text-secondary">{action.afterNote}</span>}
        </div>
      ) : (
        <TimeBlock className="col-start-3 min-[1101px]:col-start-auto" dueAt={action.dueAt} now={now} zone={zone} note={note} testId={`plan-time-${action.key}`} dateOnly={action.dateOnly} />
      )}
    </div>
  );
}

/**
 * "Action plan": the steps to close the issue as a table, Step | Action | Assigned to | Deadline, in process order, the same for every
 * viewer: acknowledge, notify, assess, investigate and resolve, confirm the resolution, then the root cause report. A step that waits for an earlier one is marked "Waiting".
 * Completed steps are lines under the table, with their evidence. Times are the server demo clock, ticked in the browser, in the viewer's zone.
 */
export function ActionPlan({
  plan,
  done,
  viewerId,
  serverNow,
  zone,
  displayId,
  notice,
  issueId,
  entityName,
  canApprove,
}: {
  plan: RoleAction[];
  done: RoleAction[];
  viewerId: string;
  serverNow: Date;
  zone: string;
  displayId: string;
  /** A muted line under the table (the regime-not-captured line of the root cause report). */
  notice?: React.ReactNode;
  issueId: string;
  entityName: string;
  /** Any Compliance-team user can approve the root cause report: the button shows on the Review row for them. */
  canApprove: boolean;
}) {
  const now = useTickingNow(serverNow);
  const zoneLabel = formatInZone(now, zone, { timeOnly: true }).split(" ").pop();
  return (
    <section aria-label="Action plan" data-onboarding="action-plan" className="overflow-hidden rounded-md border border-border bg-white">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3.5">
        <div className="flex items-center gap-1">
          <h2 className="text-section">Action plan</h2>
          <WhyThis note="action-plan" />
        </div>
        <span className="text-meta text-text-secondary">
          Steps to close {displayId}, in process order · Times in your zone, {zoneLabel} · Now {formatInZone(now, zone, { timeOnly: true })}
        </span>
      </div>
      <div className="hidden grid-cols-[36px_minmax(0,1fr)_230px_200px] gap-x-5 border-t border-border bg-tint px-5 py-2 text-meta font-medium text-text-secondary min-[1101px]:grid">
        <span>Step</span>
        <span>Action</span>
        <span>Assigned to</span>
        <span>Deadline</span>
      </div>
      {plan.length === 0 && <p className="border-t border-border px-5 py-3.5 text-body text-text-secondary">No open steps on this issue</p>}
      {plan.map((a, i) => (
        <Step key={`${a.key}-${a.person.id}`} action={a} n={i + 1} viewerId={viewerId} now={now} zone={zone} approve={canApprove ? <ReportReviewActions issueId={issueId} displayId={displayId} entityName={entityName} links /> : null} />
      ))}
      {notice && (
        <p data-testid="plan-notice" className="border-t border-border px-5 py-3 text-meta text-text-secondary">
          {notice}
        </p>
      )}
      {done.length > 0 && (
        <div data-testid="plan-done" className="flex flex-col">
          {done.map((a) => (
            <div key={`${a.key}-${a.person.id}`} data-testid="plan-done-line" className="flex items-start gap-2 border-t border-border bg-tint px-5 py-3 text-meta text-text-secondary">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>
                Done: <DoneItem action={a} zone={zone} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
