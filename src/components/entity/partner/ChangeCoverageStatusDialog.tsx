"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CoverageStatus } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { formatDate, today } from "@/lib/dates";
import { COVERAGE_STATUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { coverageStatusLabel, coverageStatusVariant } from "@/lib/ui/status";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field-error";

const ALL_STATUSES: CoverageStatus[] = ["ONBOARDING", "ACTIVE", "DEGRADED", "SUSPENDED", "RETIRED"];
const MAX_REASON = 500;

/**
 * "Change status" dialog. Network only. M5 R1:
 * effective date capped at today; Retired moves only to Onboarding.
 *
 * Brief M23 AC4: the partner issue's "Set to Degraded" button opens
 * this same dialog, prefilled (status Degraded, reason from the issue)
 * and controlled from outside -- `open`/`onOpenChange`/`defaultStatus`/
 * `defaultReason` turn it into a controlled, trigger-less instance
 * while the Partner-tab usage below keeps its own internal state and
 * trigger button unchanged.
 */
export function ChangeCoverageStatusDialog({
  coverageId,
  version,
  country,
  schemeLabel,
  currentStatus,
  currentEffectiveDate,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  defaultStatus,
  defaultReason,
  hideTrigger,
  onSaved,
}: {
  coverageId: string;
  version: number;
  country: string;
  schemeLabel: string;
  currentStatus: CoverageStatus | null;
  currentEffectiveDate: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultStatus?: CoverageStatus;
  defaultReason?: string;
  hideTrigger?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [openState, setOpenState] = React.useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChangeProp ?? setOpenState;
  const options = currentStatus === "RETIRED" ? (["ONBOARDING"] as CoverageStatus[]) : ALL_STATUSES.filter((s) => s !== currentStatus);
  const [status, setStatus] = React.useState<CoverageStatus>(defaultStatus ?? options[0]);
  const [effectiveDate, setEffectiveDate] = React.useState(today());
  const [reason, setReason] = React.useState(defaultReason ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const validReason = reason.trim().length >= 5 && reason.length <= MAX_REASON;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/coverage/${coverageId}/status`, "POST", { status, effectiveDate, reason, version });
      if (!result.ok) {
        if (result.kind === "validation") setError(Object.values(result.fieldErrors)[0]?.[0] ?? "Status not saved. Try again.");
        else toast.error(result.kind === "conflict" ? result.message : "Status not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Coverage status saved");
      onSaved?.();
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
        if (next) {
          setStatus(defaultStatus ?? options[0]);
          setEffectiveDate(today());
          setReason(defaultReason ?? "");
          setError(null);
        }
      }}
    >
      {!hideTrigger && (
        <Button
          variant="secondary"
          size="md"
          onClick={(e) => {
            e.stopPropagation(); // this button sits inside a <summary>; a bare click would also toggle it open/closed
            setOpen(true);
          }}
        >
          Change status
        </Button>
      )}
      <DialogContent>
        <DialogHeader>Change status: {country} / {schemeLabel}</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Current status:{" "}
            {currentStatus ? (
              <Badge variant={coverageStatusVariant(currentStatus)}>{coverageStatusLabel(currentStatus)}</Badge>
            ) : (
              <span className="text-text">None</span>
            )}
            {currentEffectiveDate && ` since ${formatDate(currentEffectiveDate)}`}
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-meta text-text-secondary">New status</label>
            <div className="flex flex-wrap gap-4">
              {options.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-body">
                  <input type="radio" name="coverageStatus" checked={status === s} onChange={() => setStatus(s)} className="size-4 accent-primary" />
                  {COVERAGE_STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="coverage-status-effective-date" className="text-meta text-text-secondary">Effective date</label>
            <Input id="coverage-status-effective-date" type="date" max={today()} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="coverage-status-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea
              id="coverage-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON}
              aria-invalid={reason.length > 0 && !validReason}
            />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={validReason ? null : "Write at least 5 characters"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!validReason} loading={pending} onClick={() => void save()}>
            Save status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
