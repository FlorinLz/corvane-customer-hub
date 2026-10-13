"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { today } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field-error";

/** The "Record verification" / "Update verification" (Licence). Compliance only. */
export function LicenceVerificationDialog({
  entityId,
  version,
  currentUserName,
  initial,
}: {
  entityId: string;
  version: number;
  currentUserName: string;
  initial?: { licenceNumber: string; issuingAuthority: string; expiryDate: string | null; noExpiry: boolean; evidenceUrl: string };
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [licenceNumber, setLicenceNumber] = React.useState(initial?.licenceNumber ?? "");
  const [issuingAuthority, setIssuingAuthority] = React.useState(initial?.issuingAuthority ?? "");
  const [noExpiry, setNoExpiry] = React.useState(initial?.noExpiry ?? false);
  const [expiryDate, setExpiryDate] = React.useState(initial?.expiryDate ?? "");
  const [verifiedOn, setVerifiedOn] = React.useState(today());
  const [evidenceUrl, setEvidenceUrl] = React.useState(initial?.evidenceUrl ?? "");
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  function reset() {
    setLicenceNumber(initial?.licenceNumber ?? "");
    setIssuingAuthority(initial?.issuingAuthority ?? "");
    setNoExpiry(initial?.noExpiry ?? false);
    setExpiryDate(initial?.expiryDate ?? "");
    setVerifiedOn(today());
    setEvidenceUrl(initial?.evidenceUrl ?? "");
    setErrors({});
  }

  async function save() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/entities/${entityId}/kyb/LICENCE`, "PUT", {
        licenceNumber,
        issuingAuthority,
        expiryDate: noExpiry ? null : expiryDate || null,
        noExpiry,
        verifiedOn,
        evidenceUrl,
        version,
      });
      if (!result.ok) {
        if (result.kind === "validation") setErrors(result.fieldErrors);
        else toast.error(result.kind === "conflict" ? result.message : "Verification not saved. Try again.");
        return;
      }
      setOpen(false);
      toast.success("Verification saved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const valid = licenceNumber.trim() && issuingAuthority.trim() && verifiedOn && evidenceUrl.trim() && (noExpiry || expiryDate);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        {initial ? "Update verification" : "Record verification"}
      </Button>
      <DialogContent>
        <DialogHeader>{initial ? "Update verification: Licence" : "Record verification: Licence"}</DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-number" className="text-meta text-text-secondary">Licence number</label>
            <Input id="licence-number" value={licenceNumber} onChange={(e) => setLicenceNumber(e.target.value)} aria-invalid={!!errors.licenceNumber} />
            {errors.licenceNumber && <FieldError>{errors.licenceNumber[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-issuing-authority" className="text-meta text-text-secondary">Issuing authority</label>
            <Input id="licence-issuing-authority" value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} aria-invalid={!!errors.issuingAuthority} />
            {errors.issuingAuthority && <FieldError>{errors.issuingAuthority[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-expiry-date" className="text-meta text-text-secondary">Expiry date</label>
            <Input id="licence-expiry-date" type="date" value={expiryDate} disabled={noExpiry} onChange={(e) => setExpiryDate(e.target.value)} aria-invalid={!!errors.expiryDate} />
            <label className="flex items-center gap-2 text-meta text-text-secondary">
              <Checkbox checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} />
              No expiry date
            </label>
            {errors.expiryDate && <FieldError>{errors.expiryDate[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-verified-by" className="text-meta text-text-secondary">Verified by</label>
            <Input id="licence-verified-by" value={currentUserName} disabled />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-verified-on" className="text-meta text-text-secondary">Verified on</label>
            <Input id="licence-verified-on" type="date" max={today()} value={verifiedOn} onChange={(e) => setVerifiedOn(e.target.value)} aria-invalid={!!errors.verifiedOn} />
            {errors.verifiedOn && <FieldError>{errors.verifiedOn[0]}</FieldError>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="licence-evidence-url" className="text-meta text-text-secondary">Evidence link</label>
            <Input id="licence-evidence-url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://" aria-invalid={!!errors.evidenceUrl} />
            {errors.evidenceUrl && <FieldError>{errors.evidenceUrl[0]}</FieldError>}
          </div>
        </DialogBody>
        <DialogFooter reason={valid ? null : !licenceNumber.trim() ? "Enter the licence number" : !issuingAuthority.trim() ? "Enter the issuing authority" : !noExpiry && !expiryDate ? "Enter the expiry date or tick No expiry date" : !verifiedOn ? "Enter the verified on date" : "Enter the evidence link"}>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={pending} onClick={() => void save()}>
            Save verification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
