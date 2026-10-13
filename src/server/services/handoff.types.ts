import type { ContactRole, Currency, EntityType, LeiStatus, Scheme, Stage } from "@prisma/client";

// Brief 3.2.5 "Handoff snapshot JSON": written once at send time and
// never updated (M3 AC10, M8 AC9).
type DateStr = string; // "2026-10-02"

export type SalesToOpsSnapshot = {
  v: 1;
  type: "SALES_TO_OPS";
  entity: {
    legalName: string;
    lei: string | null;
    leiStatus: LeiStatus | null;
    type: EntityType | null;
    country: string | null;
    groupName: string | null;
    standalone: boolean;
    bics: string[];
    aliases: string[];
  };
  products: { product: Scheme; country: string; contractingEntityName: string; targetGoLive: DateStr }[];
  commercialTerms: {
    currency: Currency;
    pricePerVerification: string;
    volumeTiers: { fromVolume: number; toVolume: number | null; pricePerVerification: string }[];
    monthlyMinimum: string | null;
    paymentTermDays: number;
  };
  slas: { availabilityPct: string | null; maxResponseMs: number | null; other: string | null };
  specialTerms: string | null;
  entitiesNotInPortal: string | null;
  notesForOnboarding: string | null;
  contacts: { role: ContactRole; fullName: string; email: string; phone: string | null; jobTitle: string | null }[];
};

/** Brief 3.2.5, M8 AC3-AC6. Snapshot taken at send time; later record edits never change it (AC14). */
export type OpsToCsSnapshot = {
  v: 1;
  type: "OPS_TO_CS";
  productStages: { product: Scheme; country: string; stage: Stage; stageEnteredAt: DateStr; billableFrom: DateStr | null }[];
  openBlocks: { product: Scheme; country: string; blockedBy: string; reason: string; blockedSince: DateStr; note: string }[];
  commitments: { description: string; dueDate: DateStr | null }[] | "NONE";
  confirmedContacts: { role: ContactRole; fullName: string; email: string; phone: string | null; lastVerifiedAt: DateStr | null; confirmedNow: boolean }[];
  noteForCsm: string | null;
};
