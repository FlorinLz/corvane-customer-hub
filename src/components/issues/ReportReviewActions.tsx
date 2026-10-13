"use client";

import { ApproveReportDialog } from "@/components/issues/ApproveReportDialog";
import { RequestChangesDialog } from "@/components/issues/RequestChangesDialog";

/**
 * Compliance's two actions on the approval step: "Approve report" (optional note) and "Request changes" (reason required).
 * In "Your next action" they are buttons, Approve the one filled primary. In the Action plan row (`links`) both are text links,
 * so the page has a single primary for this step.
 */
export function ReportReviewActions({ issueId, displayId, entityName, links = false }: { issueId: string; displayId: string; entityName: string; links?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ApproveReportDialog issueId={issueId} displayId={displayId} entityName={entityName} triggerVariant={links ? "text" : "primary"} />
      <RequestChangesDialog issueId={issueId} displayId={displayId} entityName={entityName} triggerVariant={links ? "text" : "secondary"} />
    </div>
  );
}
