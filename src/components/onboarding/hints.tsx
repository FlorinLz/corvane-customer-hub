"use client";

import * as React from "react";

import { Lightbulb } from "lucide-react";

import { approvedDocHosts } from "@/lib/validation/url";

/**
 * Hints the open scenario puts next to the forms of its own steps. The panel (OnboardingHost) publishes what is active; the forms read it.
 * They never fill a field. A tiny external store, so a form far from the panel needs no prop and no provider.
 */
export interface ScenarioHints {
  /** Scenario 2, while its Report issue step is open. */
  report: boolean;
  /** Scenario 1 chapter 2, while its Share draft step is open. */
  draft: boolean;
}

const NONE: ScenarioHints = { report: false, draft: false };
let current: ScenarioHints = NONE;
const listeners = new Set<() => void>();

export function setScenarioHints(next: ScenarioHints) {
  if (next.report === current.report && next.draft === current.draft) return;
  current = next;
  listeners.forEach((l) => l());
}

export function useScenarioHints(): ScenarioHints {
  return React.useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => NONE,
  );
}

/** What to enter in each Report issue field for scenario 2 (shown only while that step is open). */
export const REPORT_HINTS = {
  entity: "Lloyds Bank plc",
  type: "Partner degraded or unavailable",
  coverage: "UK CoP, GB",
  description: "Summarise Paul's message",
  aware: "Leave it at now",
} as const;

export type ReportHintField = keyof typeof REPORT_HINTS;

/** A small hint under a Report issue field, in the scenario accent. Nothing outside scenario 2's Report issue step. */
export function ReportHint({ field }: { field: ReportHintField }) {
  const { report } = useScenarioHints();
  if (!report) return null;
  return (
    <p data-onboarding-hint={field} className="flex items-center gap-1 text-meta italic text-link-text">
      <Lightbulb className="size-3.5 shrink-0" aria-hidden />
      {REPORT_HINTS[field]}
    </p>
  );
}

/** An example link on the approved document host for the draft: the field accepts nothing else. */
export function DraftHint() {
  const { draft } = useScenarioHints();
  if (!draft) return null;
  return (
    <p data-onboarding-hint="draft-link" className="flex items-center gap-1 text-meta italic text-link-text">
      <Lightbulb className="size-3.5 shrink-0" aria-hidden />
      For example https://{approvedDocHosts()[0]}/reports/iss-1042-draft.pdf
    </p>
  );
}
