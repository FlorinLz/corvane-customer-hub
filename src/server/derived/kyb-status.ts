import type { KybCheckType, LeiStatus } from "@prisma/client";

import { daysBetween, type LocalDate } from "@/lib/dates";

export type KybChipStatus = "NOT_STARTED" | "VERIFIED" | "EXPIRING" | "EXPIRED";

const KYB_EXPIRING_DAYS = 90;

/**
 * Brief 3.2.4 "KYB status" (M12 AC8). Licence expiry = KybCheck.expiryDate
 * (none when noExpiry). LEI expiry = Entity.leiNextRenewalDate, and the
 * LEI check is additionally EXPIRED for an invalid/lapsed GLEIF status.
 * Ownership and Sanctions have no expiry.
 */
export function computeKybStatus(input: {
  type: KybCheckType;
  verifiedOn: LocalDate | null;
  expiryDate: LocalDate | null; // Licence only
  noExpiry: boolean; // Licence only
  entityLeiStatus?: LeiStatus | null; // LEI only
  entityGleifRawStatus?: string | null; // LEI only
  entityLeiNextRenewalDate?: LocalDate | null; // LEI only
  today: LocalDate;
}): KybChipStatus {
  if (!input.verifiedOn) return "NOT_STARTED";

  if (input.type === "LEI") {
    const invalidStatuses: (LeiStatus | null | undefined)[] = ["LAPSED", "RETIRED", "MERGED", "ANNULLED", "DUPLICATE"];
    if (invalidStatuses.includes(input.entityLeiStatus) || input.entityGleifRawStatus === "NOT_FOUND") {
      return "EXPIRED";
    }
    const expiry = input.entityLeiNextRenewalDate ?? null;
    if (!expiry) return "NOT_STARTED";
    if (daysBetween(input.today, expiry) < 0) return "EXPIRED";
    if (daysBetween(input.today, expiry) <= KYB_EXPIRING_DAYS) return "EXPIRING";
    return "VERIFIED";
  }

  if (input.type === "LICENCE") {
    if (input.noExpiry || !input.expiryDate) return "VERIFIED";
    if (daysBetween(input.today, input.expiryDate) < 0) return "EXPIRED";
    if (daysBetween(input.today, input.expiryDate) <= KYB_EXPIRING_DAYS) return "EXPIRING";
    return "VERIFIED";
  }

  // Ownership structure, Sanctions screening: no expiry.
  return "VERIFIED";
}
