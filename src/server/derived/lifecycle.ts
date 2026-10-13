import { LifecycleState, Stage } from "@prisma/client";

import { STAGE_ORDER } from "@/lib/labels";

const LIVE_HYPERCARE_INDEX = STAGE_ORDER.indexOf(Stage.LIVE_HYPERCARE);

/**
 * Brief 3.2.4 "Lifecycle state" and decision B1. A pure function: callers
 * (seed, and later the product/coverage/role services) gather the facts
 * and pass them in, so this stays testable without the database.
 *
 * - While currently INACTIVE, recomputation is skipped (the stored value
 *   is returned unchanged; "Mark as active" is the only thing that runs
 *   this function again).
 * - Otherwise: non-cancelled product lines decide it when there are any;
 *   partner coverage decides it only when there are none (partner-only or
 *   dual-role with no live products yet).
 */
export function computeLifecycle(input: {
  isInactive: boolean;
  activeProductStages: Stage[]; // current stage of every non-cancelled product line
  hasActivePartnerRole: boolean;
  partnerHasActiveOrDegradedCoverage: boolean;
}): LifecycleState {
  if (input.isInactive) return LifecycleState.INACTIVE;

  if (input.activeProductStages.length > 0) {
    const allBau = input.activeProductStages.every((s) => s === Stage.BAU);
    if (allBau) return LifecycleState.BAU;
    const anyLiveOrLater = input.activeProductStages.some(
      (s) => STAGE_ORDER.indexOf(s) >= LIVE_HYPERCARE_INDEX,
    );
    if (anyLiveOrLater) return LifecycleState.LIVE;
    return LifecycleState.ONBOARDING;
  }

  if (input.hasActivePartnerRole) {
    return input.partnerHasActiveOrDegradedCoverage ? LifecycleState.LIVE : LifecycleState.ONBOARDING;
  }

  return LifecycleState.ONBOARDING;
}
