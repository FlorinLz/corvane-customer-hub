"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Severity } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpenState, type ControlledOpen } from "@/components/issues/controlled-open";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const SEVERITIES: Severity[] = [Severity.SEV1, Severity.SEV2, Severity.SEV3, Severity.SEV4];
const MIN_REASON = 10;
const MAX_REASON = 500;

/** Brief M19 AC13. Owner only; the two caps come from the Issue page's current (re-derived) data. */
export function ChangeSeverityDialog({
  issueId,
  version,
  currentSeverity,
  caps,
  controlled,
}: {
  issueId: string;
  version: number;
  currentSeverity: Severity;
  caps: { preGoLive: boolean; typeCapSev1: boolean };
  controlled?: ControlledOpen;
}) {
  const router = useRouter();
  const [open, setOpen] = useOpenState(controlled);
  const [severity, setSeverity] = React.useState<Severity>(currentSeverity);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function disabledReason(s: Severity): string | null {
    if (caps.preGoLive && (s === "SEV1" || s === "SEV2")) return "Sev-3 is the maximum before go-live";
    if (caps.typeCapSev1 && s === "SEV1") return "Highest severity for this type: Sev-2";
    return null;
  }

  function reset() {
    setSeverity(currentSeverity);
    setReason("");
    setError(null);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/severity`, "POST", { severity, reason, version });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Change not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Change not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`Severity changed to ${SEVERITY_LABELS[severity]}`);
      const data = res.data as { reviewSeverityNote?: string; linkedIssues?: { id: string; number: number }[] } | undefined;
      if (data?.reviewSeverityNote) {
        toast(
          <span>
            {data.reviewSeverityNote}{" "}
            {data.linkedIssues?.map((li, i) => (
              <React.Fragment key={li.id}>
                {i > 0 && ", "}
                <Link href={`/issues/${li.id}`} className="text-link-text hover:underline">
                  {issueDisplayId(li.number)}
                </Link>
              </React.Fragment>
            ))}
          </span>,
        );
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = severity !== currentSeverity && !disabledReason(severity) && reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      {!controlled && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Change severity
        </Button>
      )}
      <DialogContent>
        <DialogHeader>Change severity</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Current severity: <Badge variant="neutral-outline">{SEVERITY_LABELS[currentSeverity]}</Badge>
          </p>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Severity">
            {SEVERITIES.map((s) => {
              const disabledMsg = disabledReason(s);
              const isCurrent = s === currentSeverity;
              return (
                <div key={s} className={disabledMsg ? "opacity-45" : ""}>
                  <label className="flex items-center gap-1.5 text-body">
                    <input type="radio" name="change-severity" checked={severity === s} disabled={!!disabledMsg} onChange={() => setSeverity(s)} className="size-4 accent-primary" />
                    <Badge variant="neutral-outline">{SEVERITY_LABELS[s]}</Badge>
                    {isCurrent && " (current)"}
                  </label>
                  {disabledMsg && <p className="ml-6 text-meta text-text-secondary">{disabledMsg}</p>}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-severity-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea id="change-severity-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} aria-invalid={reason.length > 0 && reason.trim().length < MIN_REASON} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : severity === currentSeverity ? "Choose a different severity" : disabledReason(severity) ? "Choose an available severity" : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Change severity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
