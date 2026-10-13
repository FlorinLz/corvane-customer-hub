"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTrigger } from "@/components/ui/dialog";

// Brief 4.8.2, M16 AC13; guard 5 (7.6.9 #5) blocks a reused-LEI
// reactivation outright in R1 — shown proactively (the caller already
// knows via findLeiConflictMessage()) rather than discovered only after
// a failed submit: the
// "R1: reactivation is blocked" panel shows a warning on open and Reactivate is disabled. Shared by the deleted-record banner and Admin > Deleted records.
export function ReactivateAction({
  entityId,
  legalName,
  blockedMessage = null,
  triggerVariant = "destructive-secondary",
  onReactivated,
}: {
  entityId: string;
  legalName: string;
  blockedMessage?: string | null;
  triggerVariant?: ButtonProps["variant"];
  onReactivated?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function reactivate() {
    setPending(true);
    try {
      const res = await fetch(`/api/entities/${entityId}/reactivate`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        toast.error(body?.message ?? "Action not completed. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`${legalName} reactivated`);
      onReactivated?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="md">
          Reactivate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Reactivate {legalName}?</DialogHeader>
        <DialogBody>
          <p className="text-body text-text">All its data returns to search and worklists.</p>
          {blockedMessage && (
            <div className="flex items-start gap-2 rounded-md border border-danger bg-white px-3 py-2 text-body text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{blockedMessage}</span>
            </div>
          )}
        </DialogBody>
        <DialogFooter reason={blockedMessage ? "Reactivation is blocked" : null}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!!blockedMessage} loading={pending} onClick={() => void reactivate()}>
            Reactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
