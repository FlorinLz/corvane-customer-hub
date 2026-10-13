"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * "Link entity": searches entities from the group side;
 * this is the Details-tab mirror — picking a group
 * to join — so a plain searchable Select over the (small) group list
 * substitutes for a dedicated group-search endpoint the brief doesn't
 * define). M5 R1: only offered when the entity has no group yet.
 */
export function LinkEntityDialog({ entityId, version, groups }: { entityId: string; version: number; groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [groupId, setGroupId] = React.useState<string>("");
  const [pending, setPending] = React.useState(false);

  async function save() {
    if (!groupId) return;
    setPending(true);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/group`, "PUT", { groupId, version });
      if (!result.ok) {
        toast.error(result.kind === "conflict" ? result.message : "Entity not linked. Try again.");
        return;
      }
      const group = groups.find((g) => g.id === groupId);
      setOpen(false);
      toast.success(`Entity linked to ${group?.name ?? "the group"}`);
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
        if (next) setGroupId("");
      }}
    >
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Link entity
      </Button>
      <DialogContent>
        <DialogHeader>Link entity</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="link-entity-group" className="text-meta text-text-secondary">Group</label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="link-entity-group">
                <SelectValue placeholder="Search group..." />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter reason={groupId ? null : "Choose the group"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!groupId} loading={pending} onClick={() => void save()}>
            Link entity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
