"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { ISSUE_STATUS_LABELS, issueDisplayId } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/ui/field-error";

export interface LinkedIssueRow {
  linkId: string;
  kind: "CREATED" | "ATTACHED";
  childId: string;
  number: number;
  entityName: string;
  entityDeleted: boolean;
  communicatorName: string | null;
  status: string;
  clockText: string | null;
}

/** Brief M23 AC10, AC14. */
export function LinkedIssuesPanel({ isOwner, rows, notifiedCount }: { isOwner: boolean; rows: LinkedIssueRow[]; notifiedCount: number }) {
  const router = useRouter();
  const [unlinking, setUnlinking] = React.useState<LinkedIssueRow | null>(null);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const valid = reason.trim().length >= 5 && reason.length <= 500;

  async function unlink() {
    if (!unlinking) return;
    setPending(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/issues/links/${unlinking.linkId}/unlink`, "POST", { reason });
      if (!res.ok) {
        setError(res.kind === "validation" ? Object.values(res.fieldErrors)[0]?.[0] ?? "Action not saved. Try again." : "Action not saved. Try again.");
        return;
      }
      setUnlinking(null);
      toast.success("Issue unlinked");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-subsection">
        Linked issues ({rows.length}) {rows.length > 0 && <span className="text-meta text-text-secondary">· Customers notified {notifiedCount} of {rows.length}</span>}
      </h3>
      {rows.length === 0 ? (
        <p className="text-meta text-text-secondary">No linked issues yet</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <div key={r.linkId} className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
              {r.entityDeleted ? (
                <span className="flex-1 text-body text-text-secondary">1 linked issue on a deleted record</span>
              ) : (
                <>
                  <Link href={`/issues/${r.childId}`} className="text-link-text hover:underline">
                    {issueDisplayId(r.number)}
                  </Link>
                  <span className="text-body">{r.entityName}</span>
                  <span className="text-meta text-text-secondary">{r.communicatorName ?? "—"}</span>
                  <span className="text-meta text-text-secondary">{ISSUE_STATUS_LABELS[r.status as keyof typeof ISSUE_STATUS_LABELS]}</span>
                  <span className="flex-1 text-meta text-text-secondary">{r.clockText}</span>
                  {isOwner && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setUnlinking(r);
                        setReason("");
                        setError(null);
                      }}
                    >
                      Unlink
                    </Button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!unlinking} onOpenChange={(next) => !next && setUnlinking(null)}>
        <DialogContent>
          <DialogHeader>Unlink {unlinking ? issueDisplayId(unlinking.number) : ""}</DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1">
              <label htmlFor="unlink-reason" className="text-meta text-text-secondary">Reason</label>
              <Textarea id="unlink-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} aria-invalid={reason.length > 0 && !valid} />
              <span className="self-end text-meta text-text-secondary">{reason.length} / 500</span>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </DialogBody>
          <DialogFooter reason={valid ? null : "Write at least 5 characters"}>
            <Button variant="secondary" onClick={() => setUnlinking(null)} disabled={pending}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={pending} onClick={() => void unlink()}>
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
