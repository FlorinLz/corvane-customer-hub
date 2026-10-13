"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";

/** "Edit roles". M5 R1 is add-only: an already-active role's checkbox can't be unchecked. */
export function EditRolesDialog({
  entityId,
  version,
  hasCustomer,
  hasPartner,
}: {
  entityId: string;
  version: number;
  hasCustomer: boolean;
  hasPartner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [customer, setCustomer] = React.useState(hasCustomer);
  const [partner, setPartner] = React.useState(hasPartner);
  const [pending, setPending] = React.useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCustomer(hasCustomer);
      setPartner(hasPartner);
    }
  }

  async function save() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/roles`, "PUT", { customer, partner, version });
      if (!result.ok) {
        toast.error("Roles not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Roles saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = customer || partner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button variant="text" size="md" onClick={() => onOpenChange(true)} className="h-auto p-0 text-meta">
        <Pencil className="size-3.5" aria-hidden="true" /> Edit roles
      </Button>
      <DialogContent>
        <DialogHeader>Edit roles</DialogHeader>
        <DialogBody>
          <label className="flex items-center gap-2 text-body">
            <Checkbox checked={customer} disabled={hasCustomer} onChange={(e) => setCustomer(e.target.checked)} />
            Customer
          </label>
          <label className="flex items-center gap-2 text-body">
            <Checkbox checked={partner} disabled={hasPartner} onChange={(e) => setPartner(e.target.checked)} />
            Network partner
          </label>
          {!valid && <FieldError>At least one role is required.</FieldError>}
        </DialogBody>
        <DialogFooter reason={valid ? null : "Select at least one role"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
