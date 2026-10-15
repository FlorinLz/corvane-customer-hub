"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_NOTE = 2000;

/** Compliance approves the root cause report before the owner sends it. Any Compliance-team user can; the note is optional. */
export function ApproveReportDialog({ issueId, displayId, entityName, triggerVariant = "primary" }: { issueId: string; displayId: string; entityName: string; triggerVariant?: "primary" | "secondary" | "text" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/root-cause-report/approve`, "POST", { note: note.trim() || undefined });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Approval not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Approval not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Report approved");
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
          setNote("");
          setError(null);
        }
      }}
    >
      <Button data-onboarding="approve-report" variant={triggerVariant} onClick={() => setOpen(true)}>
        Approve report
      </Button>
      <DialogContent>
        <DialogHeader>Approve root cause report</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Root cause report for {displayId}, {entityName}. Once approved, the owner can send it to the customer.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="approve-report-note" className="text-meta text-text-secondary">Note (optional)</label>
            <Textarea id="approve-report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} rows={4} />
            <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_NOTE.toLocaleString("en-GB")}</span>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button data-onboarding="approve-report-submit" loading={pending} onClick={() => void save()}>
            Approve report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
