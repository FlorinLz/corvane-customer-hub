"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { today } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_NOTE = 500;

/** "Edit renewal date". CS only. */
export function EditRenewalDateDialog({ entityId, version, currentRenewalDate }: { entityId: string; version: number; currentRenewalDate: string | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [renewalDate, setRenewalDate] = React.useState(currentRenewalDate ?? today());
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/renewal-date`, "PUT", { renewalDate, note: note || undefined, version });
      if (!result.ok) {
        if (result.kind === "validation") setError(result.fieldErrors.renewalDate?.[0] ?? "Renewal date not saved. Try again.");
        else toast.error(result.kind === "conflict" ? result.message : "Renewal date not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Renewal date saved");
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
          setRenewalDate(currentRenewalDate ?? today());
          setNote("");
          setError(null);
        }
      }}
    >
      <Button variant="text" size="md" onClick={() => setOpen(true)} className="h-auto p-0 text-meta">
        <Pencil className="size-3.5" aria-hidden="true" /> Edit renewal date
      </Button>
      <DialogContent>
        <DialogHeader>Edit renewal date</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="renewal-date-input" className="text-meta text-text-secondary">Renewal date</label>
            <Input id="renewal-date-input" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} aria-invalid={!!error} />
            {error && <FieldError>{error}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="renewal-date-note" className="text-meta text-text-secondary">Note</label>
            <Textarea id="renewal-date-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} />
            <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_NOTE}</span>
          </div>
        </DialogBody>
        <DialogFooter reason={renewalDate ? null : "Enter the renewal date"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!renewalDate} loading={pending} onClick={() => void save()}>
            Save renewal date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
