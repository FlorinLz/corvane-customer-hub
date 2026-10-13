import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { ReportIssueDrawer } from "@/components/issues/ReportIssueDrawer";
import { ISSUE_STATUS_LABELS, ISSUE_STATUS_VARIANT, ISSUE_TYPE_LABELS, SCHEME_LABELS, SEVERITY_LABELS, SEVERITY_VARIANT, TEAM_LABELS, issueDisplayId } from "@/lib/labels";
import { effectiveTimeZone, formatDateTime } from "@/lib/time-zones";
import { loadEntityIssues, type EntityIssuesData } from "@/server/queries/entity-issues";
import { getCurrentUser } from "@/server/session";

// Brief M17 screens.

type Row = EntityIssuesData["issues"][number];

function IssueRow({ issue, zone }: { issue: Row; zone: string }) {
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-3">
        <Link href={`/issues/${issue.id}`} className="font-mono text-link-text hover:underline">
          {issueDisplayId(issue.number)}
        </Link>
      </td>
      <td className="py-2 pr-3">
        <Badge variant={SEVERITY_VARIANT[issue.severity]}>{SEVERITY_LABELS[issue.severity]}</Badge>
      </td>
      <td className="py-2 pr-3">{ISSUE_TYPE_LABELS[issue.type]}</td>
      <td className="py-2 pr-3">{issue.scheme && issue.country ? `${SCHEME_LABELS[issue.scheme]} ${issue.country}` : "—"}</td>
      <td className="py-2 pr-3">
        <Badge variant={ISSUE_STATUS_VARIANT[issue.status]}>{ISSUE_STATUS_LABELS[issue.status]}</Badge>
      </td>
      <td className="py-2 pr-3">{issue.owner ? `${issue.owner.name} (${TEAM_LABELS[issue.owner.team]})` : "No owner"}</td>
      <td className="py-2 pr-3">{formatDateTime(issue.awareAt, zone)}</td>
      <td className="py-2 pr-3">
        {issue.parentLinks[0] ? <Badge variant="neutral-outline">Linked to {issueDisplayId(issue.parentLinks[0].parent.number)}</Badge> : "—"}
      </td>
    </tr>
  );
}

function IssuesTable({ issues, zone }: { issues: Row[]; zone: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-meta">
        <thead>
          <tr className="border-b border-border text-text-secondary">
            <th className="py-2 pr-3">ID</th>
            <th className="py-2 pr-3">Severity</th>
            <th className="py-2 pr-3">Type</th>
            <th className="py-2 pr-3">Scheme / country</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Owner</th>
            <th className="py-2 pr-3">Corvane aware at</th>
            <th className="py-2 pr-3">Linked</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => <IssueRow key={issue.id} issue={issue} zone={zone} />)}
        </tbody>
      </table>
    </div>
  );
}

export default async function EntityIssuesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const status = sp.status === "all" ? "all" : "open";
  const user = await getCurrentUser();
  const data = await loadEntityIssues(id, status, user.id);
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-sm border border-border-strong p-0.5">
          <Link href="?status=open" className={`rounded-sm px-3 py-1 text-body no-underline ${status === "open" ? "bg-selected text-primary" : "text-text-secondary"}`}>
            Open
          </Link>
          <Link href="?status=all" className={`rounded-sm px-3 py-1 text-body no-underline ${status === "all" ? "bg-selected text-primary" : "text-text-secondary"}`}>
            All
          </Link>
        </div>
        {!data.entity.deletedAt && <ReportIssueDrawer mode="entity" entityId={id} entityName={data.entity.legalName} viewerZone={effectiveTimeZone(user)} />}
      </div>

      {data.issues.length === 0 && data.resolvedWaiting.length === 0 ? (
        <p className="text-meta text-text-secondary">No issues reported on this entity</p>
      ) : (
        <>
          {data.issues.length === 0 ? <p className="text-meta text-text-secondary">No issues reported on this entity</p> : <IssuesTable issues={data.issues} zone={effectiveTimeZone(user)} />}

          {data.resolvedWaiting.length > 0 && (
            <details className="flex flex-col gap-2">
              <summary className="cursor-pointer text-meta font-medium text-text-secondary">
                Resolved, waiting for the customer ({data.resolvedWaiting.length})
              </summary>
              <IssuesTable issues={data.resolvedWaiting} zone={effectiveTimeZone(user)} />
            </details>
          )}
        </>
      )}
    </div>
  );
}
