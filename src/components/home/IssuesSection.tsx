"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { apiGet } from "@/lib/api-client";
import { SEVERITY_LABELS, issueDisplayId } from "@/lib/labels";
import { useTickingNow } from "@/lib/use-ticking-now";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IssueRow, IssueTableHeader } from "@/components/home/IssueRow";
import type { WorklistData } from "@/server/queries/worklist/issues";

/**
 * Brief 4.6.9, M20 AC10. Polls GET /api/worklist/issues every 60s
 * (matches server/config.ts's ISSUES_REFRESH_SECONDS, repeated here as
 * a literal since that module is server-only and not safe to import
 * into client bundles -- the same reasoning 6B's own DECISIONS.md gives
 * for severity.ts). "Refreshes after router.refresh()" needs no extra
 * wiring: navigating from the Issue page back to `/` remounts this
 * component fresh, so its own on-mount fetch already picks up the new
 * state -- no stale data to invalidate.
 */
const REFRESH_MS = 60_000;

function severityVariant(s: string): "danger" | "due" | "neutral-outline" {
  if (s === "SEV1") return "danger";
  if (s === "SEV2") return "due";
  return "neutral-outline";
}

export function IssuesSection({ viewerId, canSeeTeamScope }: { viewerId: string; canSeeTeamScope: boolean }) {
  const [data, setData] = React.useState<WorklistData | null>(null);
  const [scope, setScope] = React.useState<"mine" | "team">("mine");
  const [error, setError] = React.useState(false);
  const [retryTick, setRetryTick] = React.useState(0);
  // PO decision: collapsed by default, every time this section (re)mounts or refetches.
  const [resolvedWaitingOpen, setResolvedWaitingOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await apiGet<WorklistData>(`/api/worklist/issues?scope=${scope}`);
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setError(false);
      } else {
        setError(true);
      }
    }
    void run();
    const id = setInterval(() => void run(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // M20 AC13: "View as" switches the signed-in user via router.refresh()
    // (a soft refresh -- this client component is never remounted), so
    // viewerId must be a dependency here to force the refetch; it is
    // otherwise unused in the effect body.
  }, [scope, retryTick, viewerId]);

  // Every time on the rows is formatted from the server demo clock of the last fetch (ticked in the browser), in the viewer's zone.
  const serverNow = React.useMemo(() => new Date(data?.serverNow ?? 0), [data?.serverNow]);
  const now = useTickingNow(serverNow);
  const zone = data?.viewerZone ?? "UTC";

  const rowFor = (r: { issueId: string; number: number; severity: string; view: import("@/server/queries/worklist/issues").RowView }) => (
    <IssueRow key={r.issueId} issueId={r.issueId} number={r.number} severity={r.severity} view={r.view} now={now} zone={zone} />
  );

  return (
    <>
      <section id="worklist-issues" aria-label="Issues" className="flex flex-col rounded-md border border-border">
        <div className="flex items-center gap-2 p-4 pb-3">
          <h2 className="text-subsection">Issues {data ? `(${data.main.length})` : ""}</h2>
          <span className="text-meta text-text-secondary" data-testid="issues-note">
            {scope === "team" ? "Most urgent first, then by severity" : "Your actions first, then by deadline, then by severity"}
          </span>
          <span className="flex-1" />
          {canSeeTeamScope && (
            <div className="flex gap-1">
              <Button variant={scope === "mine" ? "secondary" : "text"} onClick={() => setScope("mine")}>
                Mine
              </Button>
              <Button variant={scope === "team" ? "secondary" : "text"} onClick={() => setScope("team")}>
                My team
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 pb-4">
            <p className="text-meta text-danger">Couldn&apos;t load your issues.</p>
            <Button variant="secondary" onClick={() => setRetryTick((n) => n + 1)}>
              Retry
            </Button>
          </div>
        )}

        {!data && !error && (
          <div className="flex flex-col gap-2 px-4 pb-4">
            <div className="h-10 animate-pulse rounded-sm bg-tint" />
            <div className="h-10 animate-pulse rounded-sm bg-tint" />
          </div>
        )}

        {data && data.main.length === 0 && data.contributing.length === 0 && data.reported.length === 0 && (
          <p className="px-4 pb-4 text-meta text-text-secondary">No issues for you. Report one from the entity record.</p>
        )}

        {data && data.main.length > 0 && (
          <div className="flex flex-col">
            <IssueTableHeader />
            {data.main.map(rowFor)}
          </div>
        )}

        {data && data.reported.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-border p-4">
            <h3 className="text-meta font-medium text-text-secondary">Reported by me</h3>
            {data.reported.map((r) => (
              <div key={r.issueId} data-testid={`issue-row-${r.issueId}`} className="flex flex-wrap items-center gap-2 border-t border-border py-2 first:border-t-0">
                <Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge>
                <span className="text-body">{issueDisplayId(r.number)}</span>
                <span className="text-meta text-text-secondary">{r.entityName}</span>
                <span className="text-meta text-text-secondary">{r.queuedUntil ? `Queued until ${r.queuedUntil}` : r.statusLabel}</span>
                <span className="text-meta text-text-secondary">Owner: {r.ownerLabel}</span>
                <span className="text-meta text-text-secondary">Communicator: {r.communicatorLabel}</span>
                <span className="flex-1" />
                <Link href={`/issues/${r.issueId}`} className="text-meta text-link-text hover:underline">
                  Open
                </Link>
              </div>
            ))}
          </div>
        )}

        {data && data.resolvedWaiting.length > 0 && (
          <div className="flex flex-col border-t border-border">
            <button
              type="button"
              onClick={() => setResolvedWaitingOpen((open) => !open)}
              aria-expanded={resolvedWaitingOpen}
              className="flex items-center gap-1.5 px-4 py-3 text-meta font-medium text-text-secondary"
            >
              {resolvedWaitingOpen ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
              Resolved, waiting for the customer ({data.resolvedWaiting.length})
            </button>
            {resolvedWaitingOpen && (
              <div className="flex flex-col">
                <IssueTableHeader />
                {data.resolvedWaiting.map(rowFor)}
              </div>
            )}
          </div>
        )}
      </section>

      {data && data.contributing.length > 0 && (
        <section id="worklist-contributing" aria-label="Contributing" className="flex flex-col rounded-md border border-border">
          <div className="flex items-center gap-2 p-4 pb-3">
            <h2 className="text-subsection">Contributing ({data.contributing.length})</h2>
          </div>
          <IssueTableHeader />
          {data.contributing.map(rowFor)}
        </section>
      )}
    </>
  );
}
