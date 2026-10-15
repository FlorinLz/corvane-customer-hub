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
  coverage: "UK CoP / GB",
  description: "Summarise Paul's message",
  aware: "Leave it at now",
} as const;

export type ReportHintField = keyof typeof REPORT_HINTS;

/** A small hint under a Report issue field, in the scenario accent. Nothing outside scenario 2's Report issue step. */
export function ReportHint({ field }: { field: ReportHintField }) {
  const { report } = useScenarioHints();
  if (!report) return null;
  return (
    <p data-onboarding-hint={field} className="flex items-center gap-1 text-meta text-text-secondary">
      <Lightbulb className="size-3.5 shrink-0 text-link-text" aria-hidden />
      {REPORT_HINTS[field]}
    </p>
  );
}

/** The example link on the approved document host: the field accepts nothing else. */
export function exampleDraftLink(): string {
  return `https://${approvedDocHosts()[0]}/reports/iss-1042-draft.pdf`;
}

/**
 * Under the Share draft link field while chapter 2's share step is open: the example, and a button that puts it in the field. The only hint
 * that fills a field; the summary stays for the visitor to write.
 */
export function DraftHint({ onUse }: { onUse: (link: string) => void }) {
  const { draft } = useScenarioHints();
  if (!draft) return null;
  const link = exampleDraftLink();
  return (
    <p data-onboarding-hint="draft-link" className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-text-secondary">
      <span className="flex items-center gap-1">
        <Lightbulb className="size-3.5 shrink-0 text-link-text" aria-hidden />
        For example {link}
      </span>
      <button type="button" data-onboarding="use-example-link" onClick={() => onUse(link)} className="text-link-text hover:underline">
        Use example link
      </button>
    </p>
  );
}
