"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AwarenessSource } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { TimesFields, timesBody, timesErrors, timesFormFrom, timesValid, type TimesFormState } from "@/components/issues/TimeFields";
import { FieldError } from "@/components/ui/field-error";

const MIN_REASON = 10;
const MAX_REASON = 500;

/** Times rule 5. Owner only; the trigger is the "Correct times" link at the right of the Timeline heading. */
export function CorrectTimesDialog({
  issueId,
  version,
  issueLabel,
  zone,
  openedAt,
  current,
  awareLocked,
}: {
  issueId: string;
  version: number;
  /** "ISS-1038 · Wrong match result · Revolut Ltd" */
  issueLabel: string;
  zone: string;
  openedAt: Date;
  current: { awareAt: Date; eventAt: Date | null; source: AwarenessSource };
  /** A monitoring issue: Corvane aware at is the alert time. */
  awareLocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<TimesFormState>(() => timesFormFrom(zone, current));
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setForm(timesFormFrom(zone, current));
    setReason("");
    setErrors({});
    setError(null);
  }

  const body = timesBody(form, zone);
  const changed =
    body.awareAt !== current.awareAt.toISOString() ||
    (body.eventAt ?? null) !== (current.eventAt?.toISOString() ?? null) ||
    body.awarenessSource !== current.source;
  const reasonOk = reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON;
  const valid = timesValid(form, zone, openedAt) && reasonOk && changed;

  async function save() {
    setPending(true);
    setError(null);
    setErrors({});
    try {
      const res = await apiRequest(`/api/issues/${issueId}/times`, "POST", {
        awareAt: awareLocked ? undefined : body.awareAt,
        eventAt: body.eventAt,
        awarenessSource: body.awarenessSource === "" ? undefined : body.awarenessSource,
        reason,
        version,
      });
      if (!res.ok) {
        if (res.kind === "validation") {
          setErrors(res.fieldErrors);
          setError(res.fieldErrors.times?.[0] ?? null);
        } else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Correction not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Times corrected");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <button type="button" onClick={() => setOpen(true)} className="text-meta text-link-text hover:underline" data-testid="correct-times-link">
        Correct times
      </button>
      <DialogContent>
        <DialogHeader>Correct times</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">{issueLabel}</p>
          <TimesFields form={form} onChange={setForm} zone={zone} openedAt={openedAt} awareLocked={awareLocked} serverErrors={errors} idPrefix="correct-times" />
          <div className="flex flex-col gap-1">
            <label htmlFor="correct-times-reason" className="text-meta text-text-secondary">Reason *</label>
            <Textarea id="correct-times-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} rows={3} aria-invalid={reason.length > 0 && !reasonOk} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
            {reason.length > 0 && !reasonOk && <FieldError>Enter 10 to 500 characters</FieldError>}
            <p className="text-meta text-text-secondary">Shown in the History event. 10 to 500 characters.</p>
          </div>
          <div className="rounded-sm border-l-4 border-l-primary bg-tint p-3 text-body" role="note">
            Deadlines will be recalculated from the corrected Corvane aware at time.
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : !timesValid(form, zone, openedAt) ? (timesErrors(form, zone, openedAt).awareAt ? "Fix the Corvane aware at time" : form.source === "" ? "Choose the source" : "Fix the event time") : !changed ? "Change a time or the source" : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
