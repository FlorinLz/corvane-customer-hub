"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BlockedBy, Scheme } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { BLOCKED_BY_LABELS, SCHEME_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MAX_REASON = 500;
const OPTIONS: BlockedBy[] = ["CUSTOMER", "INTERNAL", "PARTNER"];

/** "Mark as blocked". */
export function MarkAsBlockedDialog({ productId, version, scheme, country }: { productId: string; version: number; scheme: Scheme; country: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [blockedBy, setBlockedBy] = React.useState<BlockedBy>("CUSTOMER");
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const valid = reason.trim().length >= 5 && reason.length <= MAX_REASON;

  async function save() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/products/${productId}/block`, "PUT", { blockedBy, reason, version });
      if (!result.ok) {
        toast.error(result.kind === "conflict" ? result.message : "Block not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Marked as blocked");
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
          setBlockedBy("CUSTOMER");
          setReason("");
        }
      }}
    >
      <Button variant="destructive-secondary" size="md" onClick={() => setOpen(true)}>
        Mark as blocked
      </Button>
      <DialogContent>
        <DialogHeader>Mark as blocked: {SCHEME_LABELS[scheme]} / {country}</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1.5">
            <label className="text-meta text-text-secondary">Blocked by</label>
            <div className="flex gap-4">
              {OPTIONS.map((o) => (
                <label key={o} className="flex items-center gap-1.5 text-body">
                  <input type="radio" name="blockedBy" checked={blockedBy === o} onChange={() => setBlockedBy(o)} className="size-4 accent-primary" />
                  {BLOCKED_BY_LABELS[o]}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="mark-blocked-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea id="mark-blocked-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} aria-invalid={reason.length > 0 && !valid} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
          </div>
        </DialogBody>
        <DialogFooter reason={valid ? null : "Write at least 5 characters"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!valid} loading={pending} onClick={() => void save()}>
            Mark as blocked
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
