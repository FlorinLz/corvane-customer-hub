"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { now } from "@/lib/dates";
import { splitInZone, tzAbbreviation, zonedDateTimeToUtc } from "@/lib/time-zones";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MAX_NOTE = 500;

/**
 * "Service restored" (the deadline model). Owner only. Records when the service was back, and a short note: it stops the Restore clock and, at Sev-1,
 * moves the customer update cadence from every 60 minutes to every 4 hours. Resolve stays a separate step.
 */
export function RestoreServiceDialog({
  issueId,
  version,
  viewerZone,
  triggerVariant = "primary",
}: {
  issueId: string;
  version: number;
  viewerZone: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(() => splitInZone(now(), viewerZone).date);
  const [time, setTime] = React.useState(() => splitInZone(now(), viewerZone).time);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    const t = splitInZone(now(), viewerZone);
    setDate(t.date);
    setTime(t.time);
    setNote("");
    setError(null);
  }

  const inFuture = date !== "" && time !== "" && zonedDateTimeToUtc(date, time, viewerZone) > now();
  const valid = date !== "" && time !== "" && !inFuture;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/restore`, "POST", {
        restoredAt: zonedDateTimeToUtc(date, time, viewerZone).toISOString(),
        note: note.trim() || undefined,
        version,
      });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Service restored");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button data-onboarding="restore-service" variant={triggerVariant} onClick={() => setOpen(true)}>
        Service restored
      </Button>
      <DialogContent>
        <DialogHeader>Service restored</DialogHeader>
        <DialogBody>
          <p className="text-body text-text-secondary">Record when the service was back. Resolve is a separate step: do it once the cause is fixed.</p>
          <div className="flex flex-col gap-1">
            <span className="text-meta text-text-secondary">Restored at</span>
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="Restored date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
              <Input type="time" aria-label="Restored time" value={time} onChange={(e) => setTime(e.target.value)} className="w-[110px]" />
              <span className="text-meta text-text-secondary">{tzAbbreviation(now(), viewerZone)}</span>
            </div>
            {inFuture && <FieldError>The time can&apos;t be in the future</FieldError>}
            {error && error.includes("Corvane aware at") && <FieldError>{error}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="restore-note" className="text-meta text-text-secondary">Note</label>
            <Textarea id="restore-note" data-onboarding="restore-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))} maxLength={MAX_NOTE} rows={3} placeholder="What brought the service back" />
          </div>
          {error && !error.includes("Corvane aware at") && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : "Enter the time"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button data-onboarding="restore-service-submit" disabled={!valid} loading={pending} onClick={() => void save()}>
            Record restored
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
