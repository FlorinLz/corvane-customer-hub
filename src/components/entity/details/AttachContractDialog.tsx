"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { today } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldError } from "@/components/ui/field-error";

/** "Attach contract". M5 R1 is a new entity contract only (no existing group master agreement). */
export function AttachContractDialog({
  entityId,
  entityName,
  version,
  groupMembers,
}: {
  entityId: string;
  entityName: string;
  version: number;
  groupMembers: { id: string; legalName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [contractId, setContractId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [signingDate, setSigningDate] = React.useState(today());
  const [invoicedEntityId, setInvoicedEntityId] = React.useState(entityId);
  const [documentUrl, setDocumentUrl] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  function reset() {
    setContractId("");
    setTitle("");
    setSigningDate(today());
    setInvoicedEntityId(entityId);
    setDocumentUrl("");
    setErrors({});
  }

  async function save() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/contract`, "PUT", {
        contractId,
        title,
        signingDate,
        scope: "ENTITY_CONTRACT",
        invoicedEntityId,
        documentUrl,
        version,
      });
      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        else toast.error(result.kind === "conflict" ? result.message : "Contract not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Contract attached");
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
        if (next) reset();
      }}
    >
      <Button variant="text" size="md" onClick={() => setOpen(true)} className="h-auto p-0 text-meta">
        Attach contract
      </Button>
      <DialogContent>
        <DialogHeader>Attach contract</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-id" className="text-meta text-text-secondary">Contract ID</label>
            <Input id="attach-contract-id" value={contractId} onChange={(e) => setContractId(e.target.value)} placeholder="IPE-MSA-2026-021" aria-invalid={!!errors.contractId} />
            {errors.contractId && <FieldError>{errors.contractId[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-title" className="text-meta text-text-secondary">Title</label>
            <Input id="attach-contract-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
            {errors.title && <FieldError>{errors.title[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-signing-date" className="text-meta text-text-secondary">Signing date</label>
            <Input id="attach-contract-signing-date" type="date" value={signingDate} onChange={(e) => setSigningDate(e.target.value)} aria-invalid={!!errors.signingDate} />
            {errors.signingDate && <FieldError>{errors.signingDate[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-scope" className="text-meta text-text-secondary">Scope</label>
            <Input id="attach-contract-scope" value="Entity contract" disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-invoiced-entity" className="text-meta text-text-secondary">Invoiced entity</label>
            <Select value={invoicedEntityId} onValueChange={setInvoicedEntityId}>
              <SelectTrigger id="attach-contract-invoiced-entity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={entityId}>{entityName} (this entity)</SelectItem>
                {groupMembers.filter((m) => m.id !== entityId).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="attach-contract-document-url" className="text-meta text-text-secondary">Document link</label>
            <Input id="attach-contract-document-url" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="https://" aria-invalid={!!errors.documentUrl} />
            {errors.documentUrl && <FieldError>{errors.documentUrl[0]}</FieldError>}
          </div>
        </DialogBody>
        <DialogFooter reason={!contractId.trim() ? "Enter the contract ID" : !title.trim() ? "Enter the title" : !signingDate ? "Enter the signing date" : !documentUrl.trim() ? "Enter the document link" : null}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={!contractId.trim() || !title.trim() || !signingDate || !documentUrl.trim()}
            loading={pending}
            onClick={() => void save()}
          >
            Attach contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
