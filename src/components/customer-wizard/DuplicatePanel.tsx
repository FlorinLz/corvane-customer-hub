import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { lifecycleLabel, lifecycleVariant } from "@/lib/ui/status";
import { TEAM_LABELS } from "@/lib/labels";
import type { Team } from "@prisma/client";
import type { DuplicateMatch, FieldErrors } from "@/components/customer-wizard/types";
import { FieldError } from "@/components/ui/field-error";

const REASON_LABEL = { LEI: "LEI", BIC: "BIC", NAME: "Name" } as const;

/** Brief 3.6.2 steps 6-7. Up to 5 cards, never blocks — only the checkbox+reason gate Next. */
export function DuplicatePanel({
  matches,
  loading,
  isAdmin,
  confirmDuplicate,
  onConfirmChange,
  duplicateReason,
  onReasonChange,
  errors,
}: {
  matches: DuplicateMatch[];
  loading: boolean;
  isAdmin: boolean;
  confirmDuplicate: boolean;
  onConfirmChange: (v: boolean) => void;
  duplicateReason: string;
  onReasonChange: (v: string) => void;
  errors: FieldErrors;
}) {
  if (loading) {
    return (
      <aside aria-labelledby="dup-heading" className="flex flex-col gap-2">
        <h2 id="dup-heading" className="text-subsection">Checking for duplicates...</h2>
      </aside>
    );
  }
  if (matches.length === 0) return null;

  return (
    <aside aria-labelledby="dup-heading" className="flex flex-col gap-3">
      <h2 id="dup-heading" className="text-subsection">Possible duplicates ({matches.length})</h2>
      <div className="flex flex-col gap-3">
        {matches.map((m) => (
          <div key={m.entityId} className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <Badge variant="selected">{REASON_LABEL[m.reason]}</Badge>
              <span className="flex-1 text-body font-medium text-text">{m.legalName}</span>
              <span className="text-meta text-text-secondary">{m.country}</span>
            </div>
            {m.lei && <span className="font-mono text-meta text-text-secondary">{m.lei}</span>}
            {m.deletedAt ? (
              <>
                <span className="text-body text-text">
                  {m.reason === "LEI"
                    ? "A deleted record with this LEI exists. Ask the admin to reactivate it."
                    : "A deleted record with a similar name exists. Ask the admin to reactivate it."}
                </span>
                <span className="text-meta text-text-secondary">Deleted {m.deletedAt.slice(0, 10)}</span>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {m.hasCustomerRole && <Badge variant="selected">Customer</Badge>}
                {m.hasPartnerRole && <Badge variant="selected">Partner</Badge>}
                <Badge variant={lifecycleVariant(m.lifecycleState as Parameters<typeof lifecycleVariant>[0])}>
                  {lifecycleLabel(m.lifecycleState as Parameters<typeof lifecycleLabel>[0])}
                </Badge>
              </div>
            )}
            {!m.deletedAt && (
              <span className="text-meta text-text-secondary">
                {m.ownerName ? `Owner: ${m.ownerName}, ${TEAM_LABELS[m.ownerTeam as Team]}` : "No owner"}
              </span>
            )}
            {(!m.deletedAt || isAdmin) && (
              <Link href={`/entities/${m.entityId}/overview`} target="_blank" className="inline-flex items-center gap-1 text-meta text-link">
                Open record (new tab)
              </Link>
            )}
          </div>
        ))}
      </div>
      <label className="flex items-start gap-2">
        <Checkbox checked={confirmDuplicate} onChange={(e) => onConfirmChange(e.target.checked)} className="mt-0.5" />
        <span className="text-body text-text">I checked these records and this is a different legal entity</span>
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor="dup-reason" className="text-meta text-text-secondary">Reason *</label>
        <Textarea
          id="dup-reason"
          value={duplicateReason}
          onChange={(e) => onReasonChange(e.target.value)}
          aria-invalid={!!errors.duplicateReason}
          className="min-h-[72px]"
        />
        {errors.duplicateReason && <FieldError>{errors.duplicateReason[0]}</FieldError>}
      </div>
    </aside>
  );
}
