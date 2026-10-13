import { Suspense } from "react";
import Link from "next/link";
import type { User } from "@prisma/client";

import { PillErrorBoundary } from "@/components/home/PillErrorBoundary";
import { loadWorklistIssues } from "@/server/queries/worklist/issues";
import {
  opsToPickUp,
  opsAwaitingAcceptance,
  opsBlocked,
  opsGoLives14Days,
  opsTooLongInStage,
  opsRequiredFieldsEmpty,
  ownershipAssignedToYou,
  csToPickUp,
  csRenewals120Days,
  complianceKybAndReviewExpiries,
} from "@/server/queries/worklist/mine";

/**
 * Brief 5.3 layout region 2, "Summary strip (proposal)": one compact
 * counter per section, in section order, each a link to that section's
 * anchor; a counter whose section holds Overdue items shows in
 * `--color-danger`. Deferred from milestone 7.
 *
 * Each pill is its own tiny async Server Component in its own Suspense
 * + silent error boundary (a failed pill just doesn't render -- the
 * real section below it already shows "Could not load this list" with
 * Retry, brief 4.6.1), calling the exact same cache()-wrapped query
 * function its section below calls. React's `cache()`
 * (src/server/queries/worklist/mine.ts) de-dupes that to one DB query
 * per section per render, so the strip never doubles the page's query
 * count and never blocks or couples any section's own independent
 * loading.
 */
export function SummaryStrip({
  user,
  showSalesSection,
}: {
  user: Pick<User, "id" | "team" | "name" | "timeZone">;
  showSalesSection: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillBoundary>
        <IssuesPill user={user} />
      </PillBoundary>

      {user.team === "OPS" && (
        <>
          <PillBoundary>
            <CountPill href="#worklist-to-pick-up" title="To pick up" load={() => opsToPickUp(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-awaiting-acceptance" title="Awaiting acceptance" load={() => opsAwaitingAcceptance(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-blocked" title="Blocked" load={() => opsBlocked(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-go-lives" title="Go-lives in the next 14 days" load={() => opsGoLives14Days(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-too-long" title="Too long in current stage" load={() => opsTooLongInStage(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-required-fields" title="Required fields empty" load={() => opsRequiredFieldsEmpty(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-ownership-assigned" title="Ownership assigned to you" load={() => ownershipAssignedToYou(user.id)} />
          </PillBoundary>
        </>
      )}

      {user.team === "CS" && (
        <>
          <PillBoundary>
            <CountPill href="#worklist-ownership-assigned" title="Ownership assigned to you" load={() => ownershipAssignedToYou(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <CountPill href="#worklist-to-pick-up" title="To pick up" load={() => csToPickUp(user.id)} />
          </PillBoundary>
          <PillBoundary>
            <RenewalsPill userId={user.id} />
          </PillBoundary>
        </>
      )}

      {user.team === "COMPLIANCE" && (
        <PillBoundary>
          <CompliancePill />
        </PillBoundary>
      )}

      {user.team === "SALES" && showSalesSection && (
        <PillBoundary>
          <CountPill href="#worklist-ownership-assigned" title="Ownership assigned to you" load={() => ownershipAssignedToYou(user.id)} />
        </PillBoundary>
      )}
    </div>
  );
}

/** A chip with a zero count is muted (lighter border, secondary text); a chip with items reads at full strength. */
function PillLink({ href, title, count, danger, extra }: { href: string; title: string; count: number; danger?: boolean; extra?: string }) {
  const tone = danger ? "font-medium text-danger" : count === 0 && !extra ? "border-border/60 text-text-secondary" : "font-medium text-text";
  return (
    <Link href={href} className={`whitespace-nowrap rounded-pill border border-border px-2 py-1 text-meta hover:bg-tint ${tone}`}>
      {title} {count}
      {extra ? ` · ${extra}` : ""}
    </Link>
  );
}

function PillSkeleton() {
  return <span className="h-[26px] w-24 animate-pulse rounded-pill bg-tint" aria-hidden="true" />;
}

function PillBoundary({ children }: { children: React.ReactNode }) {
  return (
    <PillErrorBoundary>
      <Suspense fallback={<PillSkeleton />}>{children}</Suspense>
    </PillErrorBoundary>
  );
}

async function CountPill({ href, title, load }: { href: string; title: string; load: () => Promise<{ length: number }> }) {
  const rows = await load();
  return <PillLink href={href} title={title} count={rows.length} />;
}

async function IssuesPill({ user }: { user: Pick<User, "id" | "team" | "name" | "timeZone"> }) {
  const data = await loadWorklistIssues(user, "mine");
  // The chip's number is the table header's number (the Issues table); Contributing, a separate table, is named next to it.
  const extra = data.contributing.length > 0 ? `Contributing ${data.contributing.length}` : undefined;
  return <PillLink href="#worklist-issues" title="Issues" count={data.main.length} extra={extra} danger={data.main.some((r) => r.stepOverdue)} />;
}

async function RenewalsPill({ userId }: { userId: string }) {
  const rows = await csRenewals120Days(userId);
  return <PillLink href="#worklist-renewals" title="Renewals in the next 120 days" count={rows.length} danger={rows.some((r) => r.passed)} />;
}

async function CompliancePill() {
  const rows = await complianceKybAndReviewExpiries();
  return <PillLink href="#worklist-kyb-expiries" title="KYB and review expiries" count={rows.length} danger={rows.some((r) => r.bucket === "OVERDUE")} />;
}
