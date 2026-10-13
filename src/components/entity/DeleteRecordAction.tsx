"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const MIN = 10;
const MAX = 500;

// Brief 6.1 header "More" menu → "Delete record" (admin only, M16 AC8-AC9).
export function DeleteRecordAction({ entityId, legalName }: { entityId: string; legalName: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const valid = reason.length >= MIN && reason.length <= MAX;

  async function confirmDelete() {
    setPending(true);
    try {
      const res = await fetch(`/api/entities/${entityId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        toast.error("Action not completed. Try again.");
        return;
      }
      setDialogOpen(false);
      toast.success(`${legalName} deleted. Find it in Admin > Deleted records.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="More actions">
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-danger"
            onSelect={() => {
              setMenuOpen(false);
              setReason("");
              setDialogOpen(true);
            }}
          >
            Delete record
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>Delete {legalName}?</DialogHeader>
          <DialogBody>
            <p className="text-body text-text">
              The record and all its data are hidden from search, worklists and group lists. You can reactivate it from Admin &gt; Deleted records.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="delete-reason" className="text-meta text-text-secondary">
                Reason
              </label>
              <Textarea
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={MAX}
                aria-invalid={reason.length > 0 && !valid}
              />
              <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX}</span>
            </div>
          </DialogBody>
          <DialogFooter reason={valid ? null : `Write at least ${MIN} characters`}>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!valid} loading={pending} onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
