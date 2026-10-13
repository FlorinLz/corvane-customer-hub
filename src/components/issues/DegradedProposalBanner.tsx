"use client";

import * as React from "react";
import type { CoverageStatus, Scheme } from "@prisma/client";

import { formatDate } from "@/lib/dates";
import { formatInZone } from "@/lib/time-zones";
import { COVERAGE_STATUS_LABELS, SCHEME_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { ChangeCoverageStatusDialog } from "@/components/entity/partner/ChangeCoverageStatusDialog";

// "Not now" dismissal (sessionStorage) read through useSyncExternalStore,
// not a read-then-setState effect: this project's lint config forbids
// setState inside an effect body (react-hooks/set-state-in-effect), and
// useSyncExternalStore is the React-endorsed way to read a mutable
// external source without a hydration mismatch (getServerSnapshot below
// always answers "not dismissed", matching the server-rendered markup;
// React itself resyncs to the real client value right after hydration).
const dismissListeners = new Set<() => void>();
function subscribeDismissed(callback: () => void) {
  dismissListeners.add(callback);
  return () => dismissListeners.delete(callback);
}
function readDismissed(sessionKey: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey) === "1";
  } catch {
    return false;
  }
}
function markDismissed(sessionKey: string) {
  try {
    sessionStorage.setItem(sessionKey, "1");
  } catch {
    // sessionStorage unavailable: dismissal just won't persist this click
  }
  dismissListeners.forEach((l) => l());
}

/** Brief M23 AC4. Degraded proposal banner on the partner issue's Coverage block. */
export function DegradedProposalBanner({
  issueId,
  displayId,
  description,
  isNetwork,
  viewerZone,
  proposal,
}: {
  issueId: string;
  displayId: string;
  description: string;
  isNetwork: boolean;
  viewerZone: string;
  proposal: {
    coverageId: string;
    coverageVersion: number;
    scheme: Scheme;
    country: string;
    status: CoverageStatus | null;
    effectiveDate: string | null;
    changedSinceCreation: { byName: string; at: Date } | null;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const sessionKey = `degraded-proposal-dismissed:${issueId}`;
  const notNow = React.useSyncExternalStore(
    subscribeDismissed,
    () => readDismissed(sessionKey),
    () => false,
  );

  function dismiss() {
    markDismissed(sessionKey);
  }

  const schemeCountry = `${SCHEME_LABELS[proposal.scheme]} / ${proposal.country}`;
  const reason = `${displayId}: ${description}`.slice(0, 500);

  if (proposal.changedSinceCreation) {
    return (
      <section className="flex items-center gap-3 rounded-md border-l-4 border-l-success bg-tint p-3">
        <span className="flex-1 text-body">
          Coverage {schemeCountry} set to Degraded by {proposal.changedSinceCreation.byName} at {formatInZone(proposal.changedSinceCreation.at, viewerZone)}
        </span>
      </section>
    );
  }

  if (proposal.status === "DEGRADED" || proposal.status === "SUSPENDED") {
    return (
      <section className="flex items-center gap-3 rounded-md border-l-4 border-l-border bg-tint p-3">
        <span className="flex-1 text-body">
          Coverage {schemeCountry} is {COVERAGE_STATUS_LABELS[proposal.status]}{proposal.effectiveDate ? ` since ${formatDate(proposal.effectiveDate)}` : ""}
        </span>
      </section>
    );
  }

  if (!proposal.status || (proposal.status !== "ACTIVE" && proposal.status !== "ONBOARDING")) {
    return null;
  }

  return (
    <section className="flex items-center gap-3 rounded-md border-l-4 border-l-due bg-tint p-3">
      <span className="flex-1 text-body">Coverage {schemeCountry} is {COVERAGE_STATUS_LABELS[proposal.status]}. Set it to Degraded?</span>
      {isNetwork && !notNow && (
        <>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Set to Degraded
          </Button>
          <Button variant="secondary" onClick={dismiss}>
            Not now
          </Button>
        </>
      )}
      {!isNetwork && <span className="text-meta text-text-secondary">Coverage change proposed to Network</span>}
      <ChangeCoverageStatusDialog
        coverageId={proposal.coverageId}
        version={proposal.coverageVersion}
        country={proposal.country}
        schemeLabel={SCHEME_LABELS[proposal.scheme]}
        currentStatus={proposal.status}
        currentEffectiveDate={proposal.effectiveDate}
        open={open}
        onOpenChange={setOpen}
        defaultStatus="DEGRADED"
        defaultReason={reason}
        hideTrigger
      />
    </section>
  );
}
