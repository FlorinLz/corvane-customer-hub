"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api-client";
import { WORKLIST_REFRESH_EVENT } from "@/lib/worklist-events";

const REFRESH_MS = 60_000;

// Brief 5.2 Components "Home link": aria-label="Home, 1 unacknowledged
// assignment" alone, or "Home, 1 unacknowledged assignment, 2 issue steps"
// once milestone 6C's issue-step count joins it -- each clause dropped
// when its own count is 0.
function homeLinkAriaLabel(assignments: number, steps: number): string {
  const clauses: string[] = [];
  if (assignments > 0) clauses.push(`${assignments} unacknowledged assignment${assignments === 1 ? "" : "s"}`);
  if (steps > 0) clauses.push(`${steps} issue step${steps === 1 ? "" : "s"}`);
  return clauses.length > 0 ? `Home, ${clauses.join(", ")}` : "Home";
}

/**
 * Brief 5.2 Home link; badge rules in 4.6.9/M20 AC9, M9 AC9. Polls the
 * same worklist endpoint the Home "Issues" section itself uses (its own
 * `badgeCount`/`badgeRed`, "Mine" scope always, regardless of whatever
 * scope the Home page's own toggle is on) so the badge stays live on
 * every page, not only while Home is open. `badgeCount` is the Issues
 * main-list-with-a-step count plus the viewer's own unacknowledged M9
 * assignments (milestone 7, `loadWorklistIssues()`), not a second
 * polling target.
 */
export function HomeLink({ viewerEmail }: { viewerEmail: string }) {
  const pathname = usePathname();
  const active = pathname === "/";
  const [count, setCount] = React.useState(0);
  const [red, setRed] = React.useState(false);
  const [assignments, setAssignments] = React.useState(0);
  const [steps, setSteps] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await apiGet<{ badgeCount: number; badgeRed: boolean; unacknowledgedAssignments: number; issueStepCount: number }>(
        "/api/worklist/issues?scope=mine",
      );
      if (cancelled || !res.ok) return;
      setCount(res.data.badgeCount);
      setRed(res.data.badgeRed);
      setAssignments(res.data.unacknowledgedAssignments);
      setSteps(res.data.issueStepCount);
    }
    void run();
    const id = setInterval(() => void run(), REFRESH_MS);
    window.addEventListener(WORKLIST_REFRESH_EVENT, run);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener(WORKLIST_REFRESH_EVENT, run);
    };
    // M20 AC13: "View as" switches the signed-in user via router.refresh()
    // (a soft refresh -- TopBar/HomeLink live in the root layout and are
    // never remounted by it), so viewerEmail must be a dependency here to
    // force the refetch; it is otherwise unused in the effect body.
  }, [viewerEmail]);

  return (
    <Link
      href="/"
      data-onboarding="home-link"
      className={cn(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-body font-medium text-text no-underline",
        active && "bg-selected text-primary font-semibold",
      )}
      aria-label={homeLinkAriaLabel(assignments, steps)}
    >
      Home
      {count > 0 && (
        <span className={cn("inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill px-1.5 text-[12px] font-semibold text-white", red ? "bg-danger" : "bg-primary")}>
          {count}
        </span>
      )}
    </Link>
  );
}
