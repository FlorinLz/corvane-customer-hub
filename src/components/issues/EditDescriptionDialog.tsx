"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MIN = 20;
const MAX = 5000;

/** Brief M17 AC11, AC13. Reporter only, while New. */
export function EditDescriptionDialog({ issueId, version, currentDescription }: { issueId: string; version: number; currentDescription: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState(currentDescription);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/description`, "PATCH", { description, version });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Description updated");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = description.trim().length >= MIN && description.length <= MAX;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDescription(currentDescription);
          setError(null);
        }
      }}
    >
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-meta text-link-text hover:underline">
        Edit
      </button>
      <DialogContent>
        <DialogHeader>Edit description</DialogHeader>
        <DialogBody>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX} rows={5} aria-invalid={description.trim().length < MIN} />
          <span className="self-end text-meta text-text-secondary">{description.length} / {MAX}</span>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : `Write at least ${MIN} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
