"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Team } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { TEAM_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ControlledOpen } from "@/components/issues/controlled-open";
import { FieldError } from "@/components/ui/field-error";

interface Candidate {
  id: string;
  name: string;
  team: Team;
}

/** Brief M21 AC6. Owner only. Opened from the Issue header's "More actions" menu (it used to be a button in the People card). */
export function AddContributorDialog({
  issueId,
  version,
  alreadyOnIds,
  candidates,
  controlled,
}: {
  issueId: string;
  version: number;
  /** Owner, communicator and the current contributors: shown but disabled in the picker. */
  alreadyOnIds: string[];
  candidates: Candidate[];
  controlled: ControlledOpen;
}) {
  const router = useRouter();
  const [userId, setUserId] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const already = new Set(alreadyOnIds);

  async function addContributor() {
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/contributors`, "POST", { userId, version });
      if (!res.ok) {
        setError(res.kind === "validation" ? Object.values(res.fieldErrors)[0]?.[0] ?? "Could not add contributor" : "Could not add contributor. Try again.");
        return;
      }
      controlled.onOpenChange(false);
      toast.success("Contributor added");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={controlled.open}
      onOpenChange={(next) => {
        controlled.onOpenChange(next);
        if (next) {
          setUserId("");
          setError(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>Add contributor</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="add-contributor-person" className="text-meta text-text-secondary">Person</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="add-contributor-person">
                <SelectValue placeholder="Search users of all six teams" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id} disabled={already.has(c.id)}>
                    {c.name} ({TEAM_LABELS[c.team]}){already.has(c.id) ? " · Already on this issue" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </DialogBody>
        <DialogFooter reason={userId ? null : "Choose who to add"}>
          <Button variant="secondary" onClick={() => controlled.onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!userId} loading={pending} onClick={() => void addContributor()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
