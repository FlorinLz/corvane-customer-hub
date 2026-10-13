"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BlockedBy, Scheme } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { daysBetween, formatDate, today } from "@/lib/dates";
import { BLOCKED_BY_LABELS, SCHEME_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MAX_NOTE = 500;

/** "Resolve block". */
export function ResolveBlockDialog({
  productId,
  version,
  scheme,
  country,
  blockedBy,
  blockedSince,
}: {
  productId: string;
  version: number;
  scheme: Scheme;
  country: string;
  blockedBy: BlockedBy;
  blockedSince: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const days = daysBetween(blockedSince, today());

  async function save() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/products/${productId}/block/resolve`, "POST", { note: note || undefined, version });
      if (!result.ok) {
        toast.error(result.kind === "conflict" ? result.message : "Block not resolved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Block resolved");
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
        if (next) setNote("");
      }}
    >
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        Resolve block
      </Button>
      <DialogContent>
        <DialogHeader>Resolve block: {SCHEME_LABELS[scheme]} / {country}</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Blocked by {BLOCKED_BY_LABELS[blockedBy]} since {formatDate(blockedSince)} ({days} day{days === 1 ? "" : "s"})
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="resolve-block-note" className="text-meta text-text-secondary">Resolution note</label>
            <Textarea id="resolve-block-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} placeholder="Optional" />
            <span className="self-end text-meta text-text-secondary">{note.length} / {MAX_NOTE}</span>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button loading={pending} onClick={() => void save()}>
            Resolve block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
