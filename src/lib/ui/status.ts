// Brief 5.1.5 "Status colour mapping (single source: lib/ui/status.ts)".
// Every status renders as a chip with text; colour is never the only
// signal.
import type { BadgeProps } from "@/components/ui/badge";
import type { CoverageStatus, HandoffStatus, LeiStatus, LifecycleState, ReviewStatus } from "@prisma/client";
import type { KybChipStatus } from "@/server/derived/kyb-status";
import { LEI_STATUS_LABELS, LIFECYCLE_LABELS, COVERAGE_STATUS_LABELS, REVIEW_STATUS_LABELS, HANDOFF_STATUS_LABELS } from "@/lib/labels";

type Variant = NonNullable<BadgeProps["variant"]>;

export function leiStatusVariant(status: LeiStatus): Variant {
  switch (status) {
    case "ISSUED":
      return "success";
    case "LAPSED":
      return "due";
    case "PENDING_TRANSFER":
    case "PENDING_ARCHIVAL":
      return "due-outline";
    case "RETIRED":
    case "MERGED":
    case "ANNULLED":
    case "DUPLICATE":
      return "danger";
    case "NOT_VERIFIED":
    default:
      return "neutral";
  }
}

export function leiStatusLabel(status: LeiStatus): string {
  return LEI_STATUS_LABELS[status];
}

export function lifecycleVariant(state: LifecycleState): Variant {
  switch (state) {
    case "ONBOARDING":
      return "neutral";
    case "LIVE":
      return "success";
    case "BAU":
      return "brand";
    case "INACTIVE":
      return "muted";
  }
}

export function lifecycleLabel(state: LifecycleState): string {
  return LIFECYCLE_LABELS[state];
}

export function coverageStatusVariant(status: CoverageStatus): Variant {
  switch (status) {
    case "ONBOARDING":
      return "neutral";
    case "ACTIVE":
      return "success";
    case "DEGRADED":
      return "due";
    case "SUSPENDED":
      return "danger";
    case "RETIRED":
      return "muted";
  }
}

export function coverageStatusLabel(status: CoverageStatus): string {
  return COVERAGE_STATUS_LABELS[status];
}

export function kybChipVariant(status: KybChipStatus): Variant {
  switch (status) {
    case "NOT_STARTED":
      return "neutral";
    case "VERIFIED":
      return "success";
    case "EXPIRING":
      return "due";
    case "EXPIRED":
      return "danger";
  }
}

export function kybChipLabel(status: KybChipStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "VERIFIED":
      return "Verified";
    case "EXPIRING":
      return "Expiring";
    case "EXPIRED":
      return "Expired";
  }
}

export function reviewStatusVariant(status: ReviewStatus): Variant {
  switch (status) {
    case "PLANNED":
      return "neutral";
    case "IN_PROGRESS":
      return "neutral-outline";
    case "COMPLETED":
      return "success";
    case "OVERDUE":
      return "danger";
  }
}

export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}

export function handoffStatusVariant(status: HandoffStatus): Variant {
  switch (status) {
    case "SENT":
      return "due";
    case "CONFIRMED":
    case "ACCEPTED":
      return "success";
    case "DECLINED":
      return "danger";
    case "CANCELLED":
      return "neutral-outline";
  }
}

export function handoffStatusLabel(status: HandoffStatus): string {
  return HANDOFF_STATUS_LABELS[status];
}
