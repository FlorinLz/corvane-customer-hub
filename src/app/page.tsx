import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ReportIssueDrawer } from "@/components/issues/ReportIssueDrawer";
import { effectiveTimeZone } from "@/lib/time-zones";
import { SectionSkeleton } from "@/components/home/SectionCard";
import { OpsWorklist } from "@/components/home/OpsWorklist";
import { CsWorklist } from "@/components/home/CsWorklist";
import { ComplianceWorklist } from "@/components/home/ComplianceWorklist";
import { SalesWorklist, salesWorklistIsEmpty } from "@/components/home/SalesWorklist";
import { IssuesSection } from "@/components/home/IssuesSection";
import { SummaryStrip } from "@/components/home/SummaryStrip";
import { WorklistErrorBoundary } from "@/components/home/WorklistErrorBoundary";
import { TEAM_LABELS } from "@/lib/labels";
import { can } from "@/server/permissions/can";
import { getCurrentUser } from "@/server/session";
import { isIssuesEmpty, loadWorklistIssues } from "@/server/queries/worklist/issues";
import { formatDate, today } from "@/lib/dates";

// Brief 4.6.1: no stored list, every write revalidates this path (mutate()).
export const dynamic = "force-dynamic";

function formatSubtitle(name: string, team: string): string {
  const [year, month, day] = today().split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(d);
  const dateStr = formatDate(today());
  return `${name} · ${team} · ${weekday} ${dateStr}`;
}

// S1 Home: my worklist. The "Issues" section (6C, M20) stays first, above
// the R1 M11 sections this milestone adds below it (brief 5.3, 7.6.5).
export default async function HomePage() {
  const user = await getCurrentUser();
  const canSeeTeamScope = user.team === "OPS" || user.team === "CS";

  let noOwnSections = false;
  if (user.team === "NETWORK" || user.team === "FINANCE") {
    noOwnSections = true;
  } else if (user.team === "SALES") {
    noOwnSections = await salesWorklistIsEmpty(user.id);
  }

  // "Your worklist is clear" only when every section is empty: the team's own sections (none for Network and Finance, or empty for Sales) AND Issues / Contributing.
  const showClear = noOwnSections && isIssuesEmpty(await loadWorklistIssues(user, "mine"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <h1 className="text-page">My worklist</h1>
          <p className="text-meta text-text-secondary">{formatSubtitle(user.name, TEAM_LABELS[user.team])}</p>
        </div>
        {/* Every user who can report an issue today (the entity page's permission): the affected entity is chosen in the drawer. Secondary, so it does not compete with the primary buttons in the lists. */}
        {can(user, "issue.report").ok && <ReportIssueDrawer mode="home" viewerZone={effectiveTimeZone(user)} />}
        {can(user, "customer.create").ok && (
          <Button asChild size="lg">
            <Link href="/customers/new">New customer</Link>
          </Button>
        )}
      </div>

      <SummaryStrip user={user} showSalesSection={user.team === "SALES" && !noOwnSections} />

      <IssuesSection viewerId={user.id} canSeeTeamScope={canSeeTeamScope} />

      {/* OpsWorklist/CsWorklist each wrap their own sections in their own Suspense + error
          boundary internally (brief 4.6.1: one failing/slow section must not affect its
          siblings), so they render directly here rather than under one shared boundary. */}
      {user.team === "OPS" && <OpsWorklist userId={user.id} />}
      {user.team === "CS" && <CsWorklist userId={user.id} />}
      {user.team === "COMPLIANCE" && (
        <WorklistErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <ComplianceWorklist />
          </Suspense>
        </WorklistErrorBoundary>
      )}
      {user.team === "SALES" && !noOwnSections && (
        <WorklistErrorBoundary>
          <Suspense fallback={<SectionSkeleton />}>
            <SalesWorklist userId={user.id} />
          </Suspense>
        </WorklistErrorBoundary>
      )}

      {showClear && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-border p-8 text-center">
          <p className="text-body font-medium">Your worklist is clear</p>
          <Link href="/search" className="text-meta text-link-text hover:underline">Go to Search</Link>
        </div>
      )}
    </div>
  );
}
