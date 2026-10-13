import type { Scheme } from "@prisma/client";
import { cache } from "react";

import { db } from "@/server/db";
import { today, daysBetween, addDays, formatDate } from "@/lib/dates";
import { STAGE_ORDER, SCHEME_LABELS } from "@/lib/labels";
import { contactOwnerTeams } from "@/server/derived/contact-ownership";
import { WORKLIST } from "@/server/config";

// Brief 4.6 "Worklist engine (M11)". R1 only: "Mine" scope for every
// team (the "Mine / My team" toggle is R2, brief 5.3's own release
// note). One exported function per section, parallel to 6C's
// src/server/queries/worklist/issues.ts -- no stored list, computed
// fresh on every call.
//
// Every export is wrapped in React's cache() (milestone 8): each
// section's own component AND the summary strip's matching pill both
// call the same function for the same userId within one page render,
// so this de-dupes that to a single query instead of running it twice.

const LIVE_HYPERCARE_INDEX = STAGE_ORDER.indexOf("LIVE_HYPERCARE");

function schemeCountry(scheme: Scheme, country: string): string {
  return `${SCHEME_LABELS[scheme]} / ${country}`;
}

// ───────────── Ops ─────────────

export interface ToPickUpRow {
  handoffId: string;
  entityId: string;
  entityName: string;
  entityCountry: string | null;
  products: string[];
  earliestGoLive: string | null;
  sender: string;
  daysWaiting: number;
}

/** Brief 4.6.2 "To pick up", 4.6.8's own sketch. M3 AC11. */
export const opsToPickUp = cache(async (userId: string): Promise<ToPickUpRow[]> => {
  const t = today();
  const rows = await db.handoff.findMany({
    where: { type: "SALES_TO_OPS", status: "SENT", toUserId: userId, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true, country: true, products: { where: { cancelledAt: null }, select: { product: true, country: true, targetGoLive: true } } } }, fromUser: { select: { name: true } } },
  });
  return rows
    .map((h) => {
      const goLives = h.entity.products.map((p) => p.targetGoLive.toISOString().slice(0, 10)).sort();
      return {
        handoffId: h.id,
        entityId: h.entity.id,
        entityName: h.entity.legalName,
        entityCountry: h.entity.country,
        products: h.entity.products.map((p) => schemeCountry(p.product, p.country)),
        earliestGoLive: goLives[0] ?? null,
        sender: h.fromUser.name,
        daysWaiting: daysBetween(h.sentAt.toISOString().slice(0, 10), t),
      };
    })
    .sort((a, b) => b.daysWaiting - a.daysWaiting || a.entityName.localeCompare(b.entityName));
});

export interface AwaitingAcceptanceRow {
  handoffId: string;
  entityId: string;
  entityName: string;
  entityCountry: string | null;
  recipient: string;
  recipientStillCs: boolean;
  daysPending: number;
}

/** Brief 4.6.2 "Awaiting acceptance". M8 AC9, AC13. */
export const opsAwaitingAcceptance = cache(async (userId: string): Promise<AwaitingAcceptanceRow[]> => {
  const t = today();
  const rows = await db.handoff.findMany({
    where: { type: "OPS_TO_CS", status: "SENT", fromUserId: userId, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true, country: true } }, toUser: { select: { name: true, team: true } } },
  });
  return rows
    .map((h) => ({
      handoffId: h.id,
      entityId: h.entity.id,
      entityName: h.entity.legalName,
      entityCountry: h.entity.country,
      recipient: h.toUser.name,
      recipientStillCs: h.toUser.team === "CS",
      daysPending: daysBetween(h.sentAt.toISOString().slice(0, 10), t),
    }))
    .sort((a, b) => b.daysPending - a.daysPending || a.entityName.localeCompare(b.entityName));
});

export interface BlockedRow {
  entityId: string;
  entityName: string;
  productId: string;
  label: string;
  blockedBy: string;
  reason: string | null;
  daysBlocked: number;
}

/** Brief 4.6.2 "Blocked". M6 AC7, AC14. */
export const opsBlocked = cache(async (userId: string): Promise<BlockedRow[]> => {
  const t = today();
  const rows = await db.contractedProduct.findMany({
    where: { cancelledAt: null, blockedBy: { not: null }, entity: { ownerId: userId, deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  return rows
    .map((p) => ({
      entityId: p.entity.id,
      entityName: p.entity.legalName,
      productId: p.id,
      label: schemeCountry(p.product, p.country),
      blockedBy: p.blockedBy!,
      reason: p.blockedReason,
      daysBlocked: p.blockedSince ? daysBetween(p.blockedSince.toISOString().slice(0, 10), t) : 0,
    }))
    .sort((a, b) => b.daysBlocked - a.daysBlocked || a.entityName.localeCompare(b.entityName));
});

export interface GoLiveRow {
  entityId: string;
  entityName: string;
  productId: string;
  label: string;
  targetGoLive: string;
  daysUntil: number;
  stage: string;
}

/** Brief 4.6.2 "Go-lives in the next 14 days". M3 AC18. */
export const opsGoLives14Days = cache(async (userId: string): Promise<GoLiveRow[]> => {
  const t = today();
  const windowEnd = addDays(t, WORKLIST.GO_LIVE_WINDOW_DAYS);
  const liveStages = STAGE_ORDER.slice(0, LIVE_HYPERCARE_INDEX);
  const rows = await db.contractedProduct.findMany({
    where: {
      cancelledAt: null,
      stage: { in: liveStages },
      targetGoLive: { gte: new Date(t), lte: new Date(windowEnd) },
      entity: { ownerId: userId, deletedAt: null, lifecycleState: { not: "INACTIVE" } },
    },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  return rows
    .map((p) => ({
      entityId: p.entity.id,
      entityName: p.entity.legalName,
      productId: p.id,
      label: schemeCountry(p.product, p.country),
      targetGoLive: p.targetGoLive.toISOString().slice(0, 10),
      daysUntil: daysBetween(t, p.targetGoLive.toISOString().slice(0, 10)),
      stage: p.stage,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil || a.entityName.localeCompare(b.entityName));
});

export interface TooLongInStageRow {
  entityId: string;
  entityName: string;
  productId: string;
  label: string;
  stage: string;
  daysInStage: number;
  limitDays: number;
}

/** Brief 4.6.2 "Too long in current stage", 4.6.8's own SQL sketch translated to this schema. M11 AC6. */
export const opsTooLongInStage = cache(async (userId: string): Promise<TooLongInStageRow[]> => {
  const t = today();
  const rows = await db.contractedProduct.findMany({
    where: { cancelledAt: null, stage: { notIn: ["RAMP_UP", "BAU"] }, entity: { ownerId: userId, deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  return rows
    .map((p) => {
      const limitDays = p.stage === "LIVE_HYPERCARE" ? WORKLIST.STAGE_LIMIT_DAYS_HYPERCARE : WORKLIST.STAGE_LIMIT_DAYS_EARLY;
      const daysInStage = daysBetween(p.stageEnteredAt.toISOString().slice(0, 10), t);
      return { entityId: p.entity.id, entityName: p.entity.legalName, productId: p.id, label: schemeCountry(p.product, p.country), stage: p.stage, daysInStage, limitDays };
    })
    .filter((r) => r.daysInStage > r.limitDays)
    .sort((a, b) => b.daysInStage - a.daysInStage || a.entityName.localeCompare(b.entityName));
});

export interface RequiredFieldsRow {
  entityId: string;
  entityName: string;
  missing: string[];
}

/** Brief 4.6.2 "Required fields empty". M2 AC19, M4 AC15, M11 AC9. */
export const opsRequiredFieldsEmpty = cache(async (userId: string): Promise<RequiredFieldsRow[]> => {
  const activeStages = STAGE_ORDER.slice(0, LIVE_HYPERCARE_INDEX + 1); // Contract signed .. Live & hypercare
  const entities = await db.entity.findMany({
    where: {
      ownerId: userId,
      deletedAt: null,
      lifecycleState: { not: "INACTIVE" },
      customerRole: { active: true },
      products: { some: { cancelledAt: null, stage: { in: activeStages } } },
    },
    include: {
      customerRole: { select: { contractId: true } },
      products: { where: { cancelledAt: null }, select: { stage: true, targetGoLive: true } },
      contacts: { where: { context: "CUSTOMER", status: "ACTIVE" }, select: { role: true } },
    },
  });

  const rows: RequiredFieldsRow[] = [];
  for (const e of entities) {
    const missing: string[] = [];
    if (!e.lei) missing.push("LEI");
    if (!e.type) missing.push("Entity type");
    if (!e.country) missing.push("Country");
    if (!e.customerRole?.contractId) missing.push("No contract attached");
    const opsContacts = e.contacts.filter((c) => contactOwnerTeams("CUSTOMER", c.role).includes("OPS"));
    if (!opsContacts.some((c) => c.role === "TECHNICAL")) missing.push("Active Technical contact");
    if (!opsContacts.some((c) => c.role === "INCIDENT")) missing.push("Active Incident contact");
    const beforeLive = e.products.filter((p) => STAGE_ORDER.indexOf(p.stage) < LIVE_HYPERCARE_INDEX);
    if (beforeLive.some((p) => !p.targetGoLive)) missing.push("Target go-live");
    if (e.groupDecision === "NOT_SET") missing.push("Group not set");

    if (missing.length > 0) rows.push({ entityId: e.id, entityName: e.legalName, missing });
  }
  return rows.sort((a, b) => b.missing.length - a.missing.length || a.entityName.localeCompare(b.entityName));
});

// ───────────── Shared: "Ownership assigned to you" (Ops, CS, Sales) ─────────────

export interface OwnershipAssignedRow {
  assignmentId: string;
  entityId: string;
  entityName: string;
  previousOwnerName: string | null;
  assignedByName: string;
  reason: string;
  assignedAt: string;
}

/** Brief 4.6.2/4.6.3/4.6.7 "Ownership assigned to you". M9 AC9-AC11, M11 AC12. One shared section for Ops, CS and Sales (7.6.5). */
export const ownershipAssignedToYou = cache(async (userId: string): Promise<OwnershipAssignedRow[]> => {
  const rows = await db.ownerAssignment.findMany({
    where: { assigneeId: userId, acknowledgedAt: null, supersededAt: null, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } }, previousOwner: { select: { name: true } }, assignedBy: { select: { name: true } } },
    orderBy: { assignedAt: "desc" },
  });
  return rows.map((a) => ({
    assignmentId: a.id,
    entityId: a.entity.id,
    entityName: a.entity.legalName,
    previousOwnerName: a.previousOwner?.name ?? null,
    assignedByName: a.assignedBy.name,
    reason: a.reason,
    assignedAt: a.assignedAt.toISOString().slice(0, 10),
  }));
});

// ───────────── Customer Success ─────────────

export interface CsToPickUpRow {
  handoffId: string;
  entityId: string;
  entityName: string;
  entityCountry: string | null;
  sender: string;
  daysPending: number;
}

/** Brief 4.6.3 "To pick up". M8 AC10, AC13. */
export const csToPickUp = cache(async (userId: string): Promise<CsToPickUpRow[]> => {
  const t = today();
  const rows = await db.handoff.findMany({
    where: { type: "OPS_TO_CS", status: "SENT", toUserId: userId, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true, country: true } }, fromUser: { select: { name: true } } },
  });
  return rows
    .map((h) => ({
      handoffId: h.id,
      entityId: h.entity.id,
      entityName: h.entity.legalName,
      entityCountry: h.entity.country,
      sender: h.fromUser.name,
      daysPending: daysBetween(h.sentAt.toISOString().slice(0, 10), t),
    }))
    .sort((a, b) => b.daysPending - a.daysPending || a.entityName.localeCompare(b.entityName));
});

export interface RenewalRow {
  entityId: string;
  entityName: string;
  renewalDate: string;
  daysUntil: number;
  passed: boolean;
}

/** Brief 4.6.3 "Renewals in the next 120 days". M11 AC11. */
export const csRenewals120Days = cache(async (userId: string): Promise<RenewalRow[]> => {
  const t = today();
  const windowEnd = addDays(t, WORKLIST.RENEWAL_WINDOW_DAYS);
  const roles = await db.customerRole.findMany({
    where: { active: true, renewalDate: { lte: new Date(windowEnd), not: null }, entity: { ownerId: userId, deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  return roles
    .map((r) => {
      const renewalDate = r.renewalDate!.toISOString().slice(0, 10);
      const daysUntil = daysBetween(t, renewalDate);
      return { entityId: r.entity.id, entityName: r.entity.legalName, renewalDate, daysUntil, passed: daysUntil < 0 };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.entityName.localeCompare(b.entityName));
});

// ───────────── Compliance ─────────────

export type ComplianceBucket = "OVERDUE" | "WITHIN_30" | "WITHIN_60" | "WITHIN_90";

export interface ComplianceRow {
  entityId: string;
  entityName: string;
  kind: "LICENCE" | "LEI" | "REVIEW";
  label: string;
  bucket: ComplianceBucket;
  sortDate: string;
}

function bucketFor(daysUntil: number): ComplianceBucket | null {
  if (daysUntil < 0) return "OVERDUE";
  if (daysUntil <= 30) return "WITHIN_30";
  if (daysUntil <= 60) return "WITHIN_60";
  if (daysUntil <= 90) return "WITHIN_90";
  return null;
}

const LAPSED_LEI_STATUSES = new Set(["LAPSED", "RETIRED", "MERGED", "ANNULLED", "DUPLICATE"]);

/** Brief 4.6.4 "KYB and review expiries". M11 AC13. All institutions (Compliance holds no per-entity ownership). */
export const complianceKybAndReviewExpiries = cache(async (): Promise<ComplianceRow[]> => {
  const t = today();
  const windowEnd = addDays(t, WORKLIST.EXPIRY_WINDOW_DAYS);
  const rows: ComplianceRow[] = [];

  const licences = await db.kybCheck.findMany({
    where: { type: "LICENCE", noExpiry: false, expiryDate: { not: null, lte: new Date(windowEnd) }, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  for (const l of licences) {
    const expiry = l.expiryDate!.toISOString().slice(0, 10);
    const daysUntil = daysBetween(t, expiry);
    const bucket = bucketFor(daysUntil);
    if (bucket) rows.push({ entityId: l.entity.id, entityName: l.entity.legalName, kind: "LICENCE", label: daysUntil < 0 ? `Licence expired ${formatDate(expiry)}` : `Licence expires in ${daysUntil} days (${formatDate(expiry)})`, bucket, sortDate: expiry });
  }

  const entities = await db.entity.findMany({
    where: { deletedAt: null, lifecycleState: { not: "INACTIVE" }, leiStatus: { not: null } },
    select: { id: true, legalName: true, leiStatus: true, leiNextRenewalDate: true },
  });
  for (const e of entities) {
    if (e.leiStatus && LAPSED_LEI_STATUSES.has(e.leiStatus)) {
      rows.push({ entityId: e.id, entityName: e.legalName, kind: "LEI", label: "LEI lapsed in GLEIF", bucket: "OVERDUE", sortDate: t });
      continue;
    }
    if (!e.leiNextRenewalDate) continue;
    const renewal = e.leiNextRenewalDate.toISOString().slice(0, 10);
    const daysUntil = daysBetween(t, renewal);
    const bucket = bucketFor(daysUntil);
    if (bucket) rows.push({ entityId: e.id, entityName: e.legalName, kind: "LEI", label: daysUntil < 0 ? `LEI renewal overdue (${formatDate(renewal)})` : `LEI renewal in ${daysUntil} days (${formatDate(renewal)})`, bucket, sortDate: renewal });
  }

  const reviews = await db.periodicReview.findMany({
    where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, nextReviewDate: { lte: new Date(windowEnd) }, entity: { deletedAt: null, lifecycleState: { not: "INACTIVE" } } },
    include: { entity: { select: { id: true, legalName: true } } },
  });
  for (const r of reviews) {
    const due = r.nextReviewDate.toISOString().slice(0, 10);
    const daysUntil = daysBetween(t, due);
    const bucket = bucketFor(daysUntil);
    if (bucket) rows.push({ entityId: r.entity.id, entityName: r.entity.legalName, kind: "REVIEW", label: daysUntil < 0 ? `Periodic review overdue since ${formatDate(due)}` : `Periodic review due in ${daysUntil} days (${formatDate(due)})`, bucket, sortDate: due });
  }

  return rows.sort((a, b) => {
    const order: Record<ComplianceBucket, number> = { OVERDUE: 0, WITHIN_30: 1, WITHIN_60: 2, WITHIN_90: 3 };
    return order[a.bucket] - order[b.bucket] || a.sortDate.localeCompare(b.sortDate) || a.entityName.localeCompare(b.entityName);
  });
});
