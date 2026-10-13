"use client";

import * as React from "react";
import type { IssueStatus, IssueType, Severity, Team } from "@prisma/client";

import { Button, DisabledReason } from "@/components/ui/button";
import { AddContributorDialog } from "@/components/issues/AddContributorDialog";
import { ChangeSeverityDialog } from "@/components/issues/ChangeSeverityDialog";
import { ChangeStatusDialog } from "@/components/issues/ChangeStatusDialog";
import { ChangeTypeDialog } from "@/components/issues/ChangeTypeDialog";
import { ReassignIssueDialog } from "@/components/issues/ReassignIssueDialog";

type Which = "status" | "severity" | "type" | "reassign" | "contributor";

/**
 * "Issue actions", owner only: Change status, Change severity, Change type, Reassign owner and Add contributor,
 * always visible under the header, opening the existing dialogs. It replaces the "More actions" menu.
 */
export function IssueActionsBar({
  issueId,
  version,
  status,
  severity,
  type,
  severityCaps,
  ownerId,
  ownerName,
  ownerCandidates,
  canReassign,
  contributorCandidates,
  alreadyOnIds,
  eventNeeded,
}: {
  issueId: string;
  version: number;
  eventNeeded?: { awareAt: Date; zone: string };
  status: IssueStatus;
  severity: Severity;
  type: IssueType;
  severityCaps: { preGoLive: boolean; typeCapSev1: boolean };
  ownerId: string | null;
  ownerName: string | null;
  ownerCandidates: { id: string; name: string; team: Team; timeZone: string }[];
  /** Not on a Closed issue, nor on a linked issue that follows its partner issue's owner. */
  canReassign: boolean;
  contributorCandidates: { id: string; name: string; team: Team }[];
  alreadyOnIds: string[];
}) {
  const [openDialog, setOpenDialog] = React.useState<Which | null>(null);
  const controlled = (which: Which) => ({ open: openDialog === which, onOpenChange: (open: boolean) => setOpenDialog(open ? which : null) });
  const statusDisabled = status === "NEW" || status === "CLOSED";
  // Why Change status is unavailable: said as the tooltip and as a hint next to the button.
  const statusReason = status === "NEW" ? "Acknowledge first" : status === "CLOSED" ? "The issue is closed" : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Issue actions">
      <span className="mr-1 text-meta text-text-secondary">Issue actions</span>
      <span className="inline-flex items-center gap-2">
        <Button variant="secondary" disabled={statusDisabled} disabledReason={statusReason} aria-describedby={statusReason ? "change-status-reason" : undefined} onClick={() => setOpenDialog("status")}>
          Change status
        </Button>
        {statusReason && <DisabledReason id="change-status-reason">{statusReason}</DisabledReason>}
      </span>
      <Button variant="secondary" onClick={() => setOpenDialog("severity")}>
        Change severity
      </Button>
      <Button variant="secondary" onClick={() => setOpenDialog("type")}>
        Change type
      </Button>
      {canReassign && (
        <Button variant="secondary" onClick={() => setOpenDialog("reassign")}>
          Reassign owner
        </Button>
      )}
      <Button variant="secondary" onClick={() => setOpenDialog("contributor")}>
        Add contributor
      </Button>

      <ChangeStatusDialog issueId={issueId} version={version} currentStatus={status} eventNeeded={eventNeeded} controlled={controlled("status")} />
      <ChangeSeverityDialog issueId={issueId} version={version} currentSeverity={severity} caps={severityCaps} controlled={controlled("severity")} />
      <ChangeTypeDialog issueId={issueId} version={version} currentType={type} controlled={controlled("type")} />
      {canReassign && (
        <ReassignIssueDialog issueId={issueId} version={version} currentOwnerId={ownerId} currentOwnerName={ownerName} candidates={ownerCandidates} controlled={controlled("reassign")} />
      )}
      <AddContributorDialog issueId={issueId} version={version} alreadyOnIds={alreadyOnIds} candidates={contributorCandidates} controlled={controlled("contributor")} />
    </div>
  );
}
