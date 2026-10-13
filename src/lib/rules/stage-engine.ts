import { Stage } from "@prisma/client";

import type { LocalDate } from "@/lib/dates";
import { formatDate } from "@/lib/dates";
import { STAGE_ORDER } from "@/lib/labels";

export type StageChangeError = { field: "toStage" | "entryDate"; message: string };

/**
 * Brief 4.3 onboarding stage engine, M6 AC4-AC6. M5 R1 implements forward
 * N -> N+1 only; skip and back are R2 (guard 3, 7.6.9) and rejected here
 * on the `toStage` field rather than silently accepted.
 */
export function validateStageChange(input: {
  fromStage: Stage;
  toStage: Stage;
  entryDate: LocalDate;
  stageEnteredAt: LocalDate;
  today: LocalDate;
}): StageChangeError | null {
  const currentIndex = STAGE_ORDER.indexOf(input.fromStage);
  const targetIndex = STAGE_ORDER.indexOf(input.toStage);
  if (targetIndex !== currentIndex + 1) {
    return { field: "toStage", message: "Skipping or moving back a stage isn't available yet" };
  }
  if (input.entryDate > input.today) {
    return { field: "entryDate", message: "Entry date cannot be in the future" };
  }
  if (input.entryDate < input.stageEnteredAt) {
    return { field: "entryDate", message: `Entry date cannot be earlier than ${formatDate(input.stageEnteredAt)} (current stage date)` };
  }
  return null;
}

/** Brief 3.2.4 / M6 AC11: set once, on entry to Live & hypercare, and left unchanged afterwards in R1 (no backward moves yet to clear it). */
export function entersLiveHypercareFirstTime(toStage: Stage, existingBillableFrom: LocalDate | null): boolean {
  return toStage === Stage.LIVE_HYPERCARE && existingBillableFrom === null;
}
