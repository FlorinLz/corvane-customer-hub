import { GleifSource, LeiStatus } from "@prisma/client";

import type { GleifLookup } from "./client";

const KNOWN_STATUSES = new Set<string>([
  "ISSUED",
  "LAPSED",
  "RETIRED",
  "MERGED",
  "ANNULLED",
  "DUPLICATE",
  "PENDING_TRANSFER",
  "PENDING_ARCHIVAL",
]);

/** Brief 3.5.4 "GLEIF registration.status" -> stored LeiStatus. */
export function mapLeiStatus(registrationStatus: string): LeiStatus {
  return KNOWN_STATUSES.has(registrationStatus)
    ? (registrationStatus as LeiStatus)
    : LeiStatus.NOT_VERIFIED;
}

/** Brief 3.5.3 mapping to Entity's GLEIF snapshot fields. */
export interface EntityGleifFields {
  leiStatus: LeiStatus;
  gleifRawStatus: string | null;
  leiNextRenewalDate: string | null; // "YYYY-MM-DD"
  gleifCheckedAt: Date;
  gleifSource: GleifSource;
  gleifLegalName: string | null;
  gleifCountry: string | null;
  gleifDirectParentLei: string | null;
  gleifDirectParentName: string | null;
  gleifUltimateParentLei: string | null;
  gleifUltimateParentName: string | null;
  gleifSuccessorLei: string | null;
}

export function mapGleifToEntityFields(lookup: GleifLookup, checkedAt: Date): EntityGleifFields {
  if (lookup.kind === "not_found") {
    return {
      leiStatus: LeiStatus.NOT_VERIFIED,
      gleifRawStatus: "NOT_FOUND",
      leiNextRenewalDate: null,
      gleifCheckedAt: checkedAt,
      gleifSource: GleifSource.LIVE,
      gleifLegalName: null,
      gleifCountry: null,
      gleifDirectParentLei: null,
      gleifDirectParentName: null,
      gleifUltimateParentLei: null,
      gleifUltimateParentName: null,
      gleifSuccessorLei: null,
    };
  }

  if (lookup.kind === "unavailable") {
    return {
      leiStatus: LeiStatus.NOT_VERIFIED,
      gleifRawStatus: null,
      leiNextRenewalDate: null,
      gleifCheckedAt: checkedAt,
      gleifSource: GleifSource.MANUAL,
      gleifLegalName: null,
      gleifCountry: null,
      gleifDirectParentLei: null,
      gleifDirectParentName: null,
      gleifUltimateParentLei: null,
      gleifUltimateParentName: null,
      gleifSuccessorLei: null,
    };
  }

  const { record } = lookup;
  return {
    leiStatus: mapLeiStatus(record.registrationStatus),
    gleifRawStatus: record.registrationStatus,
    leiNextRenewalDate: record.nextRenewalDate,
    gleifCheckedAt: checkedAt,
    gleifSource: lookup.source === "LIVE" ? GleifSource.LIVE : GleifSource.CACHE,
    gleifLegalName: record.legalName,
    gleifCountry: record.legalAddressCountry,
    gleifDirectParentLei: record.directParent?.lei ?? null,
    gleifDirectParentName: record.directParent?.legalName ?? null,
    gleifUltimateParentLei: record.ultimateParent?.lei ?? null,
    gleifUltimateParentName: record.ultimateParent?.legalName ?? null,
    gleifSuccessorLei: record.successorLei,
  };
}

export interface GroupGleifFields {
  parentLei: string | null;
  parentLegalName: string | null;
  parentLeiStatus: LeiStatus | null;
  parentGleifCheckedAt: Date | null;
}

/** Group suggestion (M2 AC8): ultimateParent, falling back to directParent. */
export function gleifParentForGroup(lookup: GleifLookup, checkedAt: Date): GroupGleifFields {
  if (lookup.kind !== "found") {
    return { parentLei: null, parentLegalName: null, parentLeiStatus: null, parentGleifCheckedAt: null };
  }
  const parent = lookup.record.ultimateParent ?? lookup.record.directParent;
  if (!parent) {
    return { parentLei: null, parentLegalName: null, parentLeiStatus: null, parentGleifCheckedAt: null };
  }
  return {
    parentLei: parent.lei,
    parentLegalName: parent.legalName,
    parentLeiStatus: null, // the parent's own status is not fetched by the entity lookup
    parentGleifCheckedAt: checkedAt,
  };
}
