"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

/** "Unlink entity". Ops only; roles, contracts and products are unchanged. */
export function UnlinkEntityDialog({ entityId, entityName, groupId, groupName, version }: { entityId: string; entityName: string; groupId: string; groupName: string; version: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirmUnlink() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/groups/${groupId}/members/${entityId}`, "DELETE", { version });
      if (!result.ok) {
        toast.error(result.kind === "conflict" ? result.message : "Entity not unlinked. Try again.");
        return;
      }
      setOpen(false);
      toast.success(`${entityName} unlinked`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Unlink
      </Button>
      <DialogContent>
        <DialogHeader>Unlink entity</DialogHeader>
        <DialogBody>
          <p className="text-body text-text">
            Unlink {entityName} from {groupName}? It becomes a standalone entity. Its roles, contracts and products stay unchanged.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" loading={pending} onClick={() => void confirmUnlink()}>
            Unlink entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
