"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IssueStatus } from "@prisma/client";

import { formatInZone, tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { TIMES_MESSAGES } from "@/server/issues/times";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api-client";
import { ISSUE_STATUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { useOpenState, type ControlledOpen } from "@/components/issues/controlled-open";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const STATUS_OPTIONS: IssueStatus[] = [IssueStatus.IN_PROGRESS, IssueStatus.WAITING_ON_CUSTOMER, IssueStatus.WAITING_ON_PARTNER, IssueStatus.RESOLVED];
const MIN_REASON = 10;
const MAX_REASON = 500;
const MIN_ROOT_CAUSE = 20;
const MAX_ROOT_CAUSE = 2000;

/**
 * Brief M21 AC2-AC5. One dialog covers "Change status" (In progress /
 * Waiting on customer / Waiting on partner, optional note) and, when
 * the owner picks Resolved, the Resolve fields in place --
 * folding them into one component avoids a second dialog hand-off for
 * what is, from the owner's chair, a single "change status" action.
 * "Back to work" (Resolved -> In progress with a required reason) is
 * the third shape this same component renders.
 */
export function ChangeStatusDialog({
  issueId,
  version,
  currentStatus,
  controlled,
  initialStatus,
  eventNeeded,
}: {
  issueId: string;
  version: number;
  currentStatus: IssueStatus;
  controlled?: ControlledOpen;
  /** "Resolve" in Your next action opens this dialog already on Resolved. */
  initialStatus?: IssueStatus;
  /** Times rule 7: a Sev-1 with Event unknown needs Event to resolve. In a partner cascade, it applies to every linked issue. */
  eventNeeded?: { awareAt: Date; zone: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useOpenState(controlled);
  const firstStatus = initialStatus ?? STATUS_OPTIONS.find((s) => s !== currentStatus) ?? IssueStatus.IN_PROGRESS;
  const [status, setStatus] = React.useState<IssueStatus>(firstStatus);
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [rootCause, setRootCause] = React.useState("");
  const [solution, setSolution] = React.useState("");
  const [eventDate, setEventDate] = React.useState("");
  const [eventTime, setEventTime] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [cascadeConfirm, setCascadeConfirm] = React.useState<string | null>(null);

  const isBackToWork = currentStatus === "RESOLVED" && status === "IN_PROGRESS";
  const isResolve = status === "RESOLVED";

  function reset() {
    setStatus(firstStatus);
    setNote("");
    setReason("");
    setRootCause("");
    setSolution("");
    setEventDate("");
    setEventTime("");
    setError(null);
    setCascadeConfirm(null);
  }

  async function save(confirmCascade = false) {
    setPending(true);
    setError(null);
    try {
      const res = isResolve
        ? await apiRequest(`/api/issues/${issueId}/resolve`, "POST", { rootCause, solution, version, confirmCascade, ...(eventNeeded ? { eventAt: eventInstant?.toISOString() } : {}) })
        : await apiRequest(`/api/issues/${issueId}/status`, "POST", { status, note: note || undefined, reason: isBackToWork ? reason : undefined, version });
      if (!res.ok) {
        if (res.kind === "conflict" && res.needsConfirmation) {
          setCascadeConfirm(res.message);
          return;
        }
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Action not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Action not saved. Try again.");
        return;
      }
      setCascadeConfirm(null); // the confirmation dialog is a sibling of the main one: closing the main one alone left it open after a cascade resolve
      setOpen(false);
      toast.success(isResolve ? "Issue resolved" : "Status changed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const eventInstant = eventNeeded && eventDate && eventTime ? zonedDateTimeToUtc(eventDate, eventTime, eventNeeded.zone) : null;
  const eventError = eventNeeded && eventInstant && eventInstant > eventNeeded.awareAt ? `${TIMES_MESSAGES.eventAfterAware} (${formatInZone(eventNeeded.awareAt, eventNeeded.zone)})` : null;
  const eventOk = !eventNeeded || (eventInstant !== null && !eventError);

  const valid = isResolve
    ? rootCause.trim().length >= MIN_ROOT_CAUSE && rootCause.length <= MAX_ROOT_CAUSE && solution.trim().length >= MIN_ROOT_CAUSE && solution.length <= MAX_ROOT_CAUSE && eventOk
    : isBackToWork
      ? reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON
      : true;

  const disabled = currentStatus === "NEW" || currentStatus === "CLOSED";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      {!controlled && (
        <Button data-onboarding="change-status" variant="secondary" disabled={disabled} disabledReason={currentStatus === "NEW" ? "Acknowledge first" : "The issue is closed"} onClick={() => setOpen(true)}>
          Change status
        </Button>
      )}
      <DialogContent>
        <DialogHeader>Change status</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((s) => {
              const isCurrent = s === currentStatus;
              return (
                <label key={s} data-onboarding="status-option" className={`flex items-center gap-1.5 text-body ${isCurrent ? "opacity-45" : ""}`}>
                  <input type="radio" name="change-status" checked={status === s} disabled={isCurrent} onChange={() => setStatus(s)} className="size-4 accent-primary" />
                  {ISSUE_STATUS_LABELS[s]}
                  {isCurrent && " (current)"}
                </label>
              );
            })}
          </div>

          {isResolve ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="resolve-root-cause" className="text-meta text-text-secondary">Root cause</label>
                <Textarea id="resolve-root-cause" data-onboarding="resolve-root-cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} maxLength={MAX_ROOT_CAUSE} aria-invalid={rootCause.length > 0 && rootCause.trim().length < MIN_ROOT_CAUSE} />
                <span className="self-end text-meta text-text-secondary">{rootCause.length} / {MAX_ROOT_CAUSE}</span>
                {rootCause.length > 0 && rootCause.trim().length < MIN_ROOT_CAUSE && <FieldError>Enter at least 20 characters</FieldError>}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="resolve-solution" className="text-meta text-text-secondary">Solution</label>
                <Textarea id="resolve-solution" data-onboarding="resolve-solution" value={solution} onChange={(e) => setSolution(e.target.value)} maxLength={MAX_ROOT_CAUSE} aria-invalid={solution.length > 0 && solution.trim().length < MIN_ROOT_CAUSE} />
                <span className="self-end text-meta text-text-secondary">{solution.length} / {MAX_ROOT_CAUSE}</span>
                {solution.length > 0 && solution.trim().length < MIN_ROOT_CAUSE && <FieldError>Enter at least 20 characters</FieldError>}
              </div>
              {eventNeeded && (
                <div className="flex flex-col gap-1">
                  <span className="text-meta text-text-secondary" id="resolve-event-label">Event date and time *</span>
                  <div className="flex items-center gap-2">
                    <Input type="date" aria-labelledby="resolve-event-label" data-testid="resolve-event-date" data-onboarding="resolve-event-date" data-zone={eventNeeded.zone} value={eventDate} aria-invalid={!!eventError} onChange={(e) => setEventDate(e.target.value)} className="w-[170px]" />
                    <Input type="time" aria-label="Event time" data-testid="resolve-event-time" data-onboarding="resolve-event-time" data-zone={eventNeeded.zone} value={eventTime} aria-invalid={!!eventError} onChange={(e) => setEventTime(e.target.value)} className="w-[110px]" />
                    <span className="text-meta text-text-secondary">{tzAbbreviation(eventNeeded.awareAt, eventNeeded.zone)}</span>
                  </div>
                  {eventError && (
                    <FieldError>{eventError}</FieldError>
                  )}
                  <p className="text-meta text-text-secondary">Needed for the root cause report. When the problem started at the customer or partner.</p>
                </div>
              )}
            </>
          ) : isBackToWork ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="change-status-reason" className="text-meta text-text-secondary">Reason</label>
              <Textarea id="change-status-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} aria-invalid={reason.length > 0 && reason.trim().length < MIN_REASON} />
              <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="change-status-note" className="text-meta text-text-secondary">Note (optional)</label>
              <Textarea id="change-status-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_REASON))} maxLength={MAX_REASON} />
              <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_REASON}</span>
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : isResolve ? (rootCause.trim().length < MIN_ROOT_CAUSE ? `Write at least ${MIN_ROOT_CAUSE} characters in Root cause` : solution.trim().length < MIN_ROOT_CAUSE ? `Write at least ${MIN_ROOT_CAUSE} characters in Solution` : eventError ? "Fix the event time" : "Enter the event date and time") : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button data-onboarding={isResolve ? "resolve-submit" : undefined} disabled={!valid} loading={pending} onClick={() => void save()}>
            {isResolve ? "Resolve issue" : "Change status"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Brief M23 AC11: cascade confirmation, a nested Dialog rather than window.confirm() (6B precedent). */}
      <Dialog open={!!cascadeConfirm} onOpenChange={(next) => !next && setCascadeConfirm(null)}>
        <DialogContent aria-label="Resolve with linked issues">
          <DialogHeader>Resolve with linked issues</DialogHeader>
          <DialogBody>
            <p className="text-body">{cascadeConfirm}</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCascadeConfirm(null)} disabled={pending}>
              Cancel
            </Button>
            <Button data-onboarding="resolve-cascade-submit" loading={pending} onClick={() => void save(true)}>
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
