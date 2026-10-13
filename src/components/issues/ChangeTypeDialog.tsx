"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IssueType } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { ISSUE_TYPE_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { useOpenState, type ControlledOpen } from "@/components/issues/controlled-open";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const TYPES = Object.values(IssueType);
const TYPES_CAPPED_AT_SEV2: IssueType[] = ["BILLING", "COMMERCIAL_COVERAGE"];
const MIN_REASON = 10;
const MAX_REASON = 500;

/** Brief M19 AC17, AC18. Owner only; a capped type's AC18 consequence (Sev-1 -> Sev-2) is applied server-side, shown here only as a hint. */
export function ChangeTypeDialog({ issueId, version, currentType, controlled }: { issueId: string; version: number; currentType: IssueType; controlled?: ControlledOpen }) {
  const router = useRouter();
  const [open, setOpen] = useOpenState(controlled);
  const [type, setType] = React.useState<IssueType | "">("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setType("");
    setReason("");
    setError(null);
  }

  async function save() {
    if (!type) return;
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/type`, "POST", { type, reason, version });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Change not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Change not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`Type changed to ${ISSUE_TYPE_LABELS[type]}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = type !== "" && type !== currentType && reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON;

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
          Change type
        </Button>
      )}
      <DialogContent>
        <DialogHeader>Change type</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Current type: <span className="text-text">{ISSUE_TYPE_LABELS[currentType]}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-type-new-type" className="text-meta text-text-secondary">New type</label>
            <Select value={type} onValueChange={(v) => setType(v as IssueType)}>
              <SelectTrigger id="change-type-new-type">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {TYPES.filter((t) => t !== currentType).map((t) => (
                  <SelectItem key={t} value={t}>
                    {ISSUE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {type !== "" && TYPES_CAPPED_AT_SEV2.includes(type) && <span className="help text-meta text-text-secondary">Highest severity for this type: Sev-2</span>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-type-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea id="change-type-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} aria-invalid={reason.length > 0 && reason.trim().length < MIN_REASON} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
            {reason.length > 0 && reason.trim().length < MIN_REASON && <FieldError>Enter a reason of 10 to 500 characters</FieldError>}
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : type === "" ? "Choose the new type" : type === currentType ? "Choose a different type" : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Change type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
