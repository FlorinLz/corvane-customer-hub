"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { notifyWorklistChanged } from "@/lib/worklist-events";
import { Button } from "@/components/ui/button";

/** The owner-assignment banner — the "Acknowledge" surface (brief 4.5; Home's worklist row is milestone 11). */
export function AcknowledgeAssignmentBanner({
  assignmentId,
  assignedByName,
  reason,
  assignedAt,
}: {
  assignmentId: string;
  assignedByName: string;
  reason: string;
  assignedAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  async function acknowledge() {
    setPending(true);
    try {
      const result = await apiRequest(`/api/owner-assignments/${assignmentId}/acknowledge`, "POST");
      if (!result.ok) {
        toast.error("Could not acknowledge. Try again.");
        return;
      }
      setDismissed(true);
      notifyWorklistChanged();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-border border-l-4 border-l-link-text bg-tint-strong p-3">
      <span className="flex-1 text-body">
        You were assigned as owner on {formatDate(assignedAt)} by {assignedByName}: {reason}
      </span>
      <Button variant="secondary" loading={pending} onClick={() => void acknowledge()}>
        Acknowledge
      </Button>
    </div>
  );
}
