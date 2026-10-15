"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { DraftHint } from "@/components/onboarding/hints";
import { isReportLink } from "@/lib/validation/issues";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_LINK = 2048;
const MIN_SUMMARY = 10;
const MAX_SUMMARY = 2000;
const LINK_MESSAGE = "Enter a link starting with https://docs.corvane-internal.example/";

/** The owner shares a draft of the root cause report: the link to it and a summary. Compliance approves it or asks for changes; the app sends nothing. */
export function ShareDraftDialog({ issueId, version, displayId, entityName, triggerVariant = "primary" }: { issueId: string; version: number; displayId: string; entityName: string; triggerVariant?: "primary" | "secondary" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [link, setLink] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const linkError = link.trim() !== "" && (link.length > MAX_LINK ? "Link must be 2,048 characters or fewer" : !isReportLink(link.trim()) ? LINK_MESSAGE : null);
  const summaryShort = summary.length > 0 && summary.trim().length < MIN_SUMMARY;
  const valid = link.trim() !== "" && !linkError && summary.trim().length >= MIN_SUMMARY && summary.length <= MAX_SUMMARY;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/root-cause-report/draft`, "POST", { draftLink: link.trim(), draftSummary: summary, version });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Draft not shared. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Draft not shared. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Draft shared");
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
          setLink("");
          setSummary("");
          setError(null);
        }
      }}
    >
      <Button data-onboarding="share-draft" variant={triggerVariant} onClick={() => setOpen(true)}>
        Share draft
      </Button>
      <DialogContent>
        <DialogHeader>Share draft of the root cause report</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Root cause report for {displayId}, {entityName}. Compliance approves it or asks for changes before you send it.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="share-draft-link" className="text-meta text-text-secondary">Draft link *</label>
            <Input id="share-draft-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.corvane-internal.example/reports/…" aria-invalid={!!linkError} />
            {linkError ? <FieldError>{linkError}</FieldError> : <p className="text-meta text-text-secondary">Only links on docs.corvane-internal.example.</p>}
            <DraftHint onUse={setLink} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="share-draft-summary" className="text-meta text-text-secondary">Summary *</label>
            <Textarea id="share-draft-summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={MAX_SUMMARY} rows={5} placeholder="What the report covers: cause, impact, corrective actions" aria-invalid={summaryShort} />
            <span className="self-end text-meta text-text-secondary">{summary.length} / {MAX_SUMMARY.toLocaleString("en-GB")}</span>
            {summaryShort && <FieldError>Enter at least 10 characters</FieldError>}
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : link.trim() === "" ? "Enter the draft link" : linkError ? "Fix the draft link" : `Write at least ${MIN_SUMMARY} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button data-onboarding="share-draft-submit" disabled={!valid} loading={pending} onClick={() => void save()}>
            Share draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
