"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { notifyWorklistChanged } from "@/lib/worklist-events";
import { Button } from "@/components/ui/button";
import type { OwnershipAssignedRow } from "@/server/queries/worklist/mine";

/** Brief 4.6.2/4.6.3/4.6.7, 7.6.5 "one shared section component" (Ops, CS, Sales). M9 AC9-AC11, M11 AC12, AC25's one read-only exception. */
export function OwnershipAssignedSection({ rows }: { rows: OwnershipAssignedRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  async function acknowledge(id: string) {
    setPendingId(id);
    try {
      const res = await apiRequest(`/api/owner-assignments/${id}/acknowledge`, "POST");
      if (!res.ok) {
        toast.error("Could not acknowledge. Try again.");
        return;
      }
      setDismissed((s) => new Set(s).add(id));
      notifyWorklistChanged();
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  const visible = rows.filter((r) => !dismissed.has(r.assignmentId));
  if (visible.length === 0) {
    return <p className="text-meta text-text-secondary">Nothing to do here</p>;
  }

  return (
    <div className="flex flex-col">
      {visible.map((r) => (
        <div key={r.assignmentId} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
          <span className="text-body font-medium">{r.entityName}</span>
          <span className="text-meta text-text-secondary">
            from {r.previousOwnerName ?? "no owner"} · by {r.assignedByName} · {formatDate(r.assignedAt)}: {r.reason}
          </span>
          <span className="flex-1" />
          <Button variant="secondary" loading={pendingId === r.assignmentId} onClick={() => void acknowledge(r.assignmentId)}>
            Acknowledge
          </Button>
          <Link href={`/entities/${r.entityId}/overview`} className="text-meta text-link-text hover:underline">
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}
