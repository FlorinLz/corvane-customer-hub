"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import type { IssueStatus, Severity, Team } from "@prisma/client";

import { ISSUE_STATUS_LABELS, ISSUE_STATUS_VARIANT, ISSUE_TYPE_LABELS, SEVERITY_LABELS, SEVERITY_VARIANT, TEAM_LABELS, issueDisplayId } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";

/** The issue page header: ID, type, Sev, status and the owner, one line. Everything else lives in the blocks below it. */
export function IssueHeader({
  number,
  type,
  severity,
  status,
  ownerName,
  ownerTeam,
}: {
  number: number;
  type: keyof typeof ISSUE_TYPE_LABELS;
  severity: Severity;
  status: IssueStatus;
  ownerName: string | null;
  ownerTeam: Team;
}) {
  const displayId = issueDisplayId(number);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(displayId);
    } catch {
      // clipboard unavailable: no-op
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-section">{displayId}</span>
      <IconButton aria-label="Copy issue ID" onClick={() => void copyId()}>
        <Copy className="size-3.5" aria-hidden="true" />
      </IconButton>
      <h1 className="min-w-0 text-page">{ISSUE_TYPE_LABELS[type]}</h1>
      <Badge variant={SEVERITY_VARIANT[severity]}>{SEVERITY_LABELS[severity]}</Badge>
      <Badge variant={ISSUE_STATUS_VARIANT[status]}>{ISSUE_STATUS_LABELS[status]}</Badge>
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <span className="flex items-center gap-1.5 text-body" data-testid="header-owner">
        <span className="text-text-secondary">Owner:</span>
        <span className="font-medium">{ownerName ?? "unassigned"}</span>
        <span className="text-text-secondary">({TEAM_LABELS[ownerTeam]})</span>
      </span>
    </div>
  );
}
