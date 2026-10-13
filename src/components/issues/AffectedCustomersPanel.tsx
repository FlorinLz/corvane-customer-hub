"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { IssueStatus, IssueType, Scheme, Severity, Stage } from "@prisma/client";

import { apiRequest } from "@/lib/api-client";
import { formatInZone } from "@/lib/time-zones";
import { ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS, SCHEME_LABELS, SEVERITY_LABELS, STAGE_LABELS, issueDisplayId } from "@/lib/labels";

function schemeCountry(l: { scheme: Scheme; country: string }): string {
  return `${SCHEME_LABELS[l.scheme]} / ${l.country}`;
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";

interface ProductLineRef {
  id: string;
  scheme: Scheme;
  country: string;
  stage: Stage;
}
interface AffectedRow {
  entityId: string;
  entityName: string;
  productLines: ProductLineRef[];
  ownerName: string | null;
  incidentNoticeHours: number | null;
  notifyBy: string | null; // ISO
  notifyByDefault: boolean;
  linkedIssue: { id: string; number: number; status: IssueStatus } | null;
  attachCandidates: { id: string; number: number; type: IssueType; severity: Severity; status: IssueStatus }[];
  defaultAction: "ATTACH" | "CREATE";
  defaultAttachId: string | null;
}

export function AffectedCustomersPanel({
  issueId,
  version,
  isOwner,
  viewerZone,
  schemeCountryLabel,
  affected,
  beforeGoLive,
}: {
  issueId: string;
  version: number;
  isOwner: boolean;
  viewerZone: string;
  schemeCountryLabel: string;
  affected: AffectedRow[];
  beforeGoLive: { entityId: string; entityName: string; productLines: ProductLineRef[] }[];
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selections, setSelections] = React.useState<Record<string, { action: "CREATE" | "ATTACH"; issueId?: string }>>({});
  const [ticked, setTicked] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toLink = affected.filter((a) => !a.linkedIssue);

  function openDialog() {
    setSelections(Object.fromEntries(toLink.map((a) => [a.entityId, { action: a.defaultAction, issueId: a.defaultAttachId ?? undefined }])));
    setTicked(Object.fromEntries(toLink.map((a) => [a.entityId, true])));
    setError(null);
    setDialogOpen(true);
  }

  async function create() {
    setPending(true);
    setError(null);
    try {
      const rows = toLink
        .filter((a) => ticked[a.entityId])
        .map((a) => {
          const sel = selections[a.entityId];
          return sel.action === "ATTACH" ? { action: "ATTACH" as const, entityId: a.entityId, issueId: sel.issueId! } : { action: "CREATE" as const, entityId: a.entityId };
        });
      if (rows.length === 0) {
        setError("Select at least one affected customer");
        return;
      }
      const res = await apiRequest(`/api/issues/${issueId}/linked-issues`, "POST", { rows, version });
      if (!res.ok) {
        setError(res.kind === "validation" ? Object.values(res.fieldErrors)[0]?.[0] ?? "Linked issues not created. Nothing was saved. Try again." : "Linked issues not created. Nothing was saved. Try again.");
        return;
      }
      setDialogOpen(false);
      toast.success("Linked issues created");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-subsection">Affected customers ({affected.length})</h3>
        <span className="flex-1" />
        {isOwner && toLink.length > 0 && (
          <Button variant="secondary" onClick={openDialog}>
            Create linked issues
          </Button>
        )}
      </div>

      {affected.length === 0 ? (
        <p className="text-meta text-text-secondary">No live customers on {schemeCountryLabel}. Nothing to notify.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead>
              <tr className="text-meta text-text-secondary">
                <th className="py-1 text-left">Entity</th>
                <th className="py-1 text-left">Product line</th>
                <th className="py-1 text-left">Stage</th>
                <th className="py-1 text-left">Communicator</th>
                <th className="py-1 text-left">Notify within</th>
                <th className="py-1 text-left">Notify by</th>
                <th className="py-1 text-left">Linked issue</th>
              </tr>
            </thead>
            <tbody>
              {affected.map((a) => (
                <tr key={a.entityId} className="border-t border-border">
                  <td className="py-1.5">{a.entityName}</td>
                  <td className="py-1.5">{a.productLines.map(schemeCountry).join(", ")}</td>
                  <td className="py-1.5">{a.productLines.map((l) => STAGE_LABELS[l.stage]).join(", ")}</td>
                  <td className="py-1.5">{a.ownerName ?? "—"}</td>
                  <td className="py-1.5">{a.incidentNoticeHours != null ? `${a.incidentNoticeHours} h` : "Not captured"}</td>
                  <td className="py-1.5">
                    {a.notifyBy ? formatInZone(new Date(a.notifyBy), viewerZone) : "—"}
                    {a.notifyByDefault && <span className="ml-1 text-meta text-text-secondary">(default)</span>}
                  </td>
                  <td className="py-1.5">
                    {a.linkedIssue ? (
                      <>
                        <Link href={`/issues/${a.linkedIssue.id}`} className="text-link-text hover:underline">
                          {issueDisplayId(a.linkedIssue.number)}
                        </Link>
                        <span className="ml-2 text-meta text-text-secondary">{ISSUE_STATUS_LABELS[a.linkedIssue.status]}</span>
                      </>
                    ) : (
                      "None"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {beforeGoLive.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-meta text-text-secondary">Not affected: before go-live ({beforeGoLive.length})</summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-meta text-text-secondary">
            {beforeGoLive.map((b) => (
              <li key={b.entityId}>
                {b.entityName} · {b.productLines.map(schemeCountry).join(", ")} · {b.productLines.map((l) => STAGE_LABELS[l.stage]).join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>Create linked issues</DialogHeader>
          <DialogBody>
            {toLink.map((a) => {
              const sel = selections[a.entityId];
              return (
                <div key={a.entityId} className="flex flex-col gap-1 border-b border-border pb-2">
                  <label className="flex items-center gap-2 text-body font-medium">
                    <input type="checkbox" checked={!!ticked[a.entityId]} onChange={(e) => setTicked((t) => ({ ...t, [a.entityId]: e.target.checked }))} className="size-4" />
                    {a.entityName}
                  </label>
                  {ticked[a.entityId] && (
                    <div className="ml-6 flex flex-col gap-1">
                      {a.attachCandidates.map((c) => (
                        <label key={c.id} className="flex items-center gap-1.5 text-meta">
                          <input
                            type="radio"
                            name={`action-${a.entityId}`}
                            checked={sel?.action === "ATTACH" && sel.issueId === c.id}
                            onChange={() => setSelections((s) => ({ ...s, [a.entityId]: { action: "ATTACH", issueId: c.id } }))}
                            className="size-4 accent-primary"
                          />
                          Attach {issueDisplayId(c.number)} ({ISSUE_TYPE_LABELS[c.type]}, <Badge variant="neutral-outline">{SEVERITY_LABELS[c.severity]}</Badge>)
                        </label>
                      ))}
                      <label className="flex items-center gap-1.5 text-meta">
                        <input
                          type="radio"
                          name={`action-${a.entityId}`}
                          checked={sel?.action === "CREATE"}
                          onChange={() => setSelections((s) => ({ ...s, [a.entityId]: { action: "CREATE" } }))}
                          className="size-4 accent-primary"
                        />
                        Create a new linked issue
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {error && <FieldError>{error}</FieldError>}
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button loading={pending} onClick={() => void create()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
