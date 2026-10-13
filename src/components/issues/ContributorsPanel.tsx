"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { Team } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { TEAM_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

interface Contributor {
  userId: string;
  name: string;
  team: Team;
  /** Added when the root cause report task was created (M27 AC4). */
  forReport?: boolean;
}

/** Brief M21 AC6. Owner only for Remove (Add is in the header's "More actions" menu); everyone sees the list. */
export function ContributorsPanel({
  issueId,
  version,
  isOwner,
  contributors,
}: {
  issueId: string;
  version: number;
  isOwner: boolean;
  contributors: Contributor[];
}) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = React.useState<Contributor | null>(null);
  const [pending, setPending] = React.useState(false);

  async function removeContributor() {
    if (!removeTarget) return;
    setPending(true);
    try {
      const res = await apiRequest(`/api/issues/${issueId}/contributors/${removeTarget.userId}/remove`, "POST", { version });
      if (!res.ok) {
        toast.error("Could not remove contributor. Try again.");
        return;
      }
      setRemoveTarget(null);
      toast.success("Contributor removed");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-meta text-text-secondary">Contributors</span>
      </div>
      {contributors.length === 0 ? (
        <p className="text-meta text-text-secondary">No contributors yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {contributors.map((c) => (
            <div key={c.userId} className="flex items-center gap-2 text-body">
              <span>
                {c.name} ({TEAM_LABELS[c.team]}){c.forReport ? ", root cause report" : ""}
              </span>
              {isOwner && (
                <button type="button" onClick={() => setRemoveTarget(c)} aria-label={`Remove ${c.name} as contributor`}>
                  <X className="size-3.5 text-text-secondary" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {removeTarget && (
        <Dialog open onOpenChange={(next) => !next && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>Remove {removeTarget.name} as contributor?</DialogHeader>
            <DialogBody>
              <p className="text-body">{removeTarget.name} stays on the issue timeline and can still add notes.</p>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setRemoveTarget(null)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" loading={pending} onClick={() => void removeContributor()}>
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
