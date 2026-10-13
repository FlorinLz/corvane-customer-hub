"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Team } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { isInBusinessHours, userCalendar } from "@/lib/business-hours";
import { now } from "@/lib/dates";
import { formatInZone, effectiveTimeZone, zoneCity } from "@/lib/time-zones";
import { Button } from "@/components/ui/button";
import { useOpenState, type ControlledOpen } from "@/components/issues/controlled-open";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

const MIN_REASON = 10;
const MAX_REASON = 500;

interface Candidate {
  id: string;
  name: string;
  team: Team;
  timeZone: string;
}

/** Brief M21 AC8-AC10, edge cases 3-4. Owner only; `candidates` is the owner team's active roster. */
export function ReassignIssueDialog({ issueId, version, currentOwnerId, currentOwnerName, candidates, controlled }: { issueId: string; version: number; currentOwnerId: string | null; currentOwnerName: string | null; candidates: Candidate[]; controlled?: ControlledOpen }) {
  const router = useRouter();
  const [open, setOpen] = useOpenState(controlled);
  const [newOwnerId, setNewOwnerId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function reset() {
    setNewOwnerId("");
    setReason("");
    setError(null);
  }

  const candidate = candidates.find((c) => c.id === newOwnerId) ?? null;
  const outsideHours = candidate ? !isInBusinessHours(now(), userCalendar(candidate)) : false;

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest<{ outsideHoursText: string | null }>(`/api/issues/${issueId}/reassign`, "POST", { newOwnerId, reason, version });
      if (!res.ok) {
        if (res.kind === "validation") setError(Object.values(res.fieldErrors)[0]?.[0] ?? "Action not saved. Try again.");
        else if (res.kind === "issue_forbidden") setError(res.message);
        else setError("Action not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`Issue reassigned to ${candidate?.name ?? ""}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = newOwnerId !== "" && newOwnerId !== currentOwnerId && reason.trim().length >= MIN_REASON && reason.length <= MAX_REASON;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      {!controlled && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Reassign issue
        </Button>
      )}
      <DialogContent>
        <DialogHeader>Reassign issue</DialogHeader>
        <DialogBody>
          <p className="text-meta text-text-secondary">
            Current owner: <span className="text-text">{currentOwnerName ?? "No owner"}</span>
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="reassign-issue-new-owner" className="text-meta text-text-secondary">New owner</label>
            <Select value={newOwnerId} onValueChange={setNewOwnerId}>
              <SelectTrigger id="reassign-issue-new-owner">
                <SelectValue placeholder="Search people..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={c.id === currentOwnerId}>
                    {c.name}
                    {c.id === currentOwnerId ? " · Current owner" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {outsideHours && candidate && (
              <p className="text-meta text-due">
                {candidate.name} is outside business hours ({formatInZone(now(), effectiveTimeZone(candidate), { timeOnly: true })} in {zoneCity(effectiveTimeZone(candidate))}). The issue
                keeps its current deadlines.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reassign-issue-reason" className="text-meta text-text-secondary">Reason</label>
            <Textarea id="reassign-issue-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={MAX_REASON} aria-invalid={reason.length > 0 && reason.trim().length < MIN_REASON} />
            <span className="self-end text-meta text-text-secondary">{reason.length} / {MAX_REASON}</span>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : newOwnerId === "" ? "Choose the new owner" : newOwnerId === currentOwnerId ? "Choose a different owner" : `Write at least ${MIN_REASON} characters`}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
