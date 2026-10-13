"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Team } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { TEAM_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MAX_REASON = 500;
const MIN_REASON = 10;

/** "Reassign owner" / "Set owner". CS only. */
export function ReassignOwnerDialog({
  entityId,
  currentOwnerId,
  currentOwnerName,
  candidates,
  pendingOpsToCsRecipient,
}: {
  entityId: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  candidates: { id: string; name: string; team: Team }[];
  pendingOpsToCsRecipient: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [newOwnerId, setNewOwnerId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const label = currentOwnerId ? "Reassign owner" : "Set owner";

  const grouped = {
    CS: candidates.filter((c) => c.team === "CS"),
    OPS: candidates.filter((c) => c.team === "OPS"),
    SALES: candidates.filter((c) => c.team === "SALES"),
  };

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/owner`, "POST", { newOwnerId, reason, expectedOwnerId: currentOwnerId });
      if (!result.ok) {
        if (result.kind === "validation") setError(Object.values(result.fieldErrors)[0]?.[0] ?? "Could not reassign owner. Try again.");
        else toast.error(result.kind === "conflict" ? result.message : "Could not reassign owner. Try again.");
        return;
      }
      setOpen(false);
      const newOwner = candidates.find((c) => c.id === newOwnerId);
      toast.success(`Owner changed to ${newOwner?.name ?? ""}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = newOwnerId && newOwnerId !== currentOwnerId && reason.trim().length >= MIN_REASON;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setNewOwnerId("");
          setReason("");
          setError(null);
        }
      }}
    >
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <DialogContent>
        <DialogHeader>{label}</DialogHeader>
        <DialogBody>
          {currentOwnerName && (
            <p className="text-meta text-text-secondary">
              Current owner: <span className="text-text">{currentOwnerName}</span>
            </p>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="reassign-owner-new-owner" className="text-meta text-text-secondary">New owner</label>
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger id="reassign-owner-new-owner">
                <SelectValue placeholder="Search people..." />
              </SelectTrigger>
              <SelectContent>
                {(["CS", "OPS", "SALES"] as const).map(
                  (team) =>
                    grouped[team].length > 0 && (
                      <SelectGroup key={team}>
                        {grouped[team].map((c) => (
                          <SelectItem key={c.id} value={c.id} disabled={c.id === currentOwnerId}>
                            {c.name} ({TEAM_LABELS[team]})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                )}
              </SelectContent>
            </Select>
            {newOwnerId && newOwnerId === currentOwnerId && <FieldError>Select a different owner</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reassign-owner-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea
              id="reassign-owner-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON}
              placeholder="Why is the owner changing? For example: on leave until February 2027"
              aria-invalid={reason.length > 0 && reason.trim().length < MIN_REASON}
            />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
          </div>
          {pendingOpsToCsRecipient && (
            <div className="rounded-md border-l-4 border-l-due bg-tint p-3 text-body text-text">
              A handoff to {pendingOpsToCsRecipient} is awaiting acceptance. If they accept, they become owner.
            </div>
          )}
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : !newOwnerId ? "Choose the new owner" : newOwnerId === currentOwnerId ? "Choose a different owner" : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
