"use client";

import { catchError, type ErrorInfo } from "next/error";

import { Button } from "@/components/ui/button";

/**
 * Brief 4.6.1 "a slow or failed section shows a skeleton or 'Could not
 * load this list' with 'Retry' while the others render" (M11 States).
 * Each worklist section's async Server Component is wrapped in its own
 * Suspense AND its own instance of this boundary, so one section's
 * thrown error never takes down its siblings or the rest of Home.
 *
 * Uses Next 16's `catchError` (stable since 16.3.0), not a hand-rolled
 * `React.Component` class boundary -- this app's AGENTS.md flags this
 * Next version as having breaking changes from training-data
 * assumptions, and this is a concrete case: a plain class boundary's
 * `reset()`-equivalent only clears local error state and re-renders
 * without re-fetching, which never recovers a Server Component error
 * (confirmed by testing a hand-rolled version first — it silently
 * failed to even render its own fallback). `catchError`'s `retry()`
 * specifically re-fetches and re-renders the boundary's children.
 */
function ErrorFallback(_props: object, { retry }: ErrorInfo) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-4">
      <p className="flex-1 text-meta text-danger">Could not load this list</p>
      <Button variant="secondary" onClick={() => retry()}>
        Retry
      </Button>
    </div>
  );
}

export const WorklistErrorBoundary = catchError(ErrorFallback);
