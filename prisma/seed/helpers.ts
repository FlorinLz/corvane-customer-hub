import { Stage } from "@prisma/client";

import { STAGE_ORDER } from "@/lib/labels";

/**
 * Brief 7.1.0 "Stage history": one stage-change row per stage passed, from
 * Contract signed to the current stage. Given dates (addedOffset,
 * billableFromOffset for Live & hypercare, stageEnteredOffset for the
 * current stage) anchor the timeline; stages with no given date get dates
 * spread evenly between the neighbouring given dates, rounded to whole
 * days.
 */
export function buildStageTimeline(params: {
  addedOffset: number;
  billableFromOffset: number | null;
  currentStage: Stage;
  stageEnteredOffset: number;
}): { stage: Stage; offset: number }[] {
  const currentIndex = STAGE_ORDER.indexOf(params.currentStage);
  const liveIndex = STAGE_ORDER.indexOf(Stage.LIVE_HYPERCARE);

  const anchors = new Map<number, number>();
  anchors.set(0, params.addedOffset);
  if (params.billableFromOffset !== null && currentIndex >= liveIndex) {
    anchors.set(liveIndex, params.billableFromOffset);
  }
  anchors.set(currentIndex, params.stageEnteredOffset);

  const sortedIdx = [...anchors.keys()].sort((a, b) => a - b);
  const timeline: { stage: Stage; offset: number }[] = [];
  for (let i = 0; i < sortedIdx.length; i++) {
    const idx = sortedIdx[i];
    const offset = anchors.get(idx)!;
    timeline.push({ stage: STAGE_ORDER[idx], offset });
    if (i < sortedIdx.length - 1) {
      const nextIdx = sortedIdx[i + 1];
      const nextOffset = anchors.get(nextIdx)!;
      const steps = nextIdx - idx;
      for (let s = idx + 1; s < nextIdx; s++) {
        const frac = (s - idx) / steps;
        timeline.push({ stage: STAGE_ORDER[s], offset: Math.round(offset + frac * (nextOffset - offset)) });
      }
    }
  }
  return timeline;
}
