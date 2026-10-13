"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OctagonAlert } from "lucide-react";
import type { BlockedBy, Scheme, Stage } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { formatDate, today } from "@/lib/dates";
import { BLOCKED_BY_LABELS, SCHEME_LABELS, STAGE_LABELS, STAGE_ORDER } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_NOTE = 500;

/** "Change stage". M5 R1: next stage only (no skip/back picker). */
export function ChangeStageDialog({
  productId,
  version,
  scheme,
  country,
  currentStage,
  stageEnteredAt,
  openBlock,
}: {
  productId: string;
  version: number;
  scheme: Scheme;
  country: string;
  currentStage: Stage;
  stageEnteredAt: string;
  openBlock: { blockedBy: BlockedBy; blockedSince: string; reason: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [entryDate, setEntryDate] = React.useState(today());
  const [note, setNote] = React.useState("");
  const [resolveBlock, setResolveBlock] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(currentStage) + 1];
  const label = `${SCHEME_LABELS[scheme]} / ${country}`;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/products/${productId}/stage`, "POST", {
        toStage: nextStage,
        entryDate,
        note: note || undefined,
        resolveBlock,
        version,
      });
      if (!result.ok) {
        if (result.kind === "validation") setError(Object.values(result.fieldErrors)[0]?.[0] ?? "Stage not saved. Try again.");
        else toast.error(result.kind === "conflict" ? result.message : "Stage not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Stage saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!nextStage) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setEntryDate(today());
          setNote("");
          setResolveBlock(false);
          setError(null);
        }
      }}
    >
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Change stage
      </Button>
      <DialogContent>
        <DialogHeader>Change stage: {label}</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Current stage: <span className="text-text">{STAGE_LABELS[currentStage]}, entered {formatDate(stageEnteredAt)}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-stage-new-stage" className="text-meta text-text-secondary">New stage</label>
            <Input id="change-stage-new-stage" value={STAGE_LABELS[nextStage]} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-stage-entry-date" className="text-meta text-text-secondary">Entry date</label>
            <Input id="change-stage-entry-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} aria-invalid={!!error} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="change-stage-note" className="text-meta text-text-secondary">Note</label>
            <Textarea id="change-stage-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} />
            <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_NOTE}</span>
          </div>
          {openBlock && (
            <div className="rounded-md border border-danger bg-white p-3">
              <div className="flex items-center gap-2 text-danger">
                <OctagonAlert className="size-4 shrink-0" aria-hidden="true" />
                <span className="text-body">
                  Blocked by {BLOCKED_BY_LABELS[openBlock.blockedBy]} since {formatDate(openBlock.blockedSince)}: {openBlock.reason}
                </span>
              </div>
              <label className="mt-2 flex items-center gap-2 text-body">
                <Checkbox checked={resolveBlock} onChange={(e) => setResolveBlock(e.target.checked)} />
                Resolve block
              </label>
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={entryDate ? null : "Enter the entry date"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!entryDate} loading={pending} onClick={() => void save()}>
            Save stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
