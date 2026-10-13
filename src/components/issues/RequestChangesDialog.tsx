"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MIN_REASON = 10;
const MAX_REASON = 2000;

/** Compliance asks for changes on the shared draft: the reason is required. The owner's Prepare step reopens; the previous draft stays in History. */
export function RequestChangesDialog({ issueId, displayId, entityName, triggerVariant = "secondary" }: { issueId: string; displayId: string; entityName: string; triggerVariant?: "secondary" | "text" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const short = reason.length > 0 && reason.trim().length < MIN_REASON;
  const valid = reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/root-cause-report/request-changes`, "POST", { reason });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Request not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Request not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Changes requested");
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
          setReason("");
          setError(null);
        }
      }}
    >
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        Request changes
      </Button>
      <DialogContent>
        <DialogHeader>Request changes to the root cause report</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Root cause report for {displayId}, {entityName}. The owner prepares a new draft; this one stays in History.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="request-changes-reason" className="text-meta text-text-secondary">Reason *</label>
            <Textarea id="request-changes-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} rows={5} aria-invalid={short} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON.toLocaleString("en-GB")}</span>
            {short && <FieldError>Enter 10 to 2,000 characters</FieldError>}
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Request changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
