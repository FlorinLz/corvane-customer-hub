import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import { confirmPickup, sendOpsToCs, acceptOpsToCs } from "@/server/services/handoff";

/**
 * Brief 7.3.1 "rules/handoff.test.ts", milestone 7. Confirm pickup
 * (M3 AC12), send and Accept (M8 AC1-AC9, AC11), and the
 * onCustomerOwnerChanged() integration (M9 AC12, 4.9.7) the done-when
 * calls out by name. Uses throwaway Handoff/Entity fixtures except the
 * one test that must exercise the real seeded Revolut Ltd / ISS-1038
 * (per the done-when's own wording) -- that one restores every field it
 * touches in `finally`, the same "never leave the shared seed changed
 * for other test files" discipline issues.test.ts documents for itself
 * (it never mutates the real ISS-1031/1038/1042, which seed.test.ts
 * asserts against verbatim; this test mutates Entity/Issue-adjacent rows
 * instead and restores them).
 */
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });

beforeAll(async () => {
  const count = await db.entity.count();
  if (count === 0) {
    throw new Error("Database is empty. Run `npm run db:reset` before this test (see the file header).");
  }
});

afterAll(async () => {
  await db.$disconnect();
});

async function user(name: string) {
  return db.user.findFirstOrThrow({ where: { name } });
}

describe("Confirm pickup (brief 3.8.2, M3 AC12)", () => {
  async function throwawaySalesToOpsFixture() {
    const tom = await user("Tom Hadley");
    const adrian = await user("Adrian Koh");
    const entity = await db.entity.create({
      data: { legalName: "Throwaway Confirm-Pickup Ltd", legalNameSearch: "throwaway confirm-pickup ltd", legalNameCore: "throwaway confirm pickup", ownerId: tom.id, groupDecision: "STANDALONE" },
    });
    const handoff = await db.handoff.create({
      data: { entityId: entity.id, type: "SALES_TO_OPS", status: "SENT", fromUserId: tom.id, toUserId: adrian.id, sentAt: now(), snapshot: { v: 1, type: "SALES_TO_OPS" } },
    });
    return { entity, handoff, tom, adrian };
  }
  // AuditEntry is append-only: even the FK's own ON DELETE SET NULL cascade
  // counts as a write the trigger blocks, so a throwaway entity that has
  // ever gone through mutate() can never be hard-deleted again. Soft-delete
  // it instead (every worklist/search query already excludes deletedAt
  // rows), rather than leaving a live stray entity in the shared seed.
  async function cleanup(entityId: string) {
    await db.historyEvent.deleteMany({ where: { entityId } });
    await db.handoff.deleteMany({ where: { entityId } });
    await db.entity.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
  }

  it("the named Onboarding Manager confirms pickup: status Confirmed, owner moves, History records both", async () => {
    const { entity, handoff, tom, adrian } = await throwawaySalesToOpsFixture();
    try {
      const updated = await confirmPickup(adrian, handoff.id);
      expect(updated.status).toBe("CONFIRMED");
      const entityAfter = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
      expect(entityAfter.ownerId).toBe(adrian.id);

      const events = await db.historyEvent.findMany({ where: { entityId: entity.id }, orderBy: { createdAt: "asc" } });
      expect(events.some((e) => e.summary === `Handoff confirmed by ${adrian.name}`)).toBe(true);
      expect(events.some((e) => e.summary === `Owner changed from ${tom.name} to ${adrian.name}`)).toBe(true);
    } finally {
      await cleanup(entity.id);
    }
  });

  it("a forged confirm by a different Ops user returns 403 and writes nothing", async () => {
    const { entity, handoff } = await throwawaySalesToOpsFixture();
    try {
      const kevin = await user("Kevin Lim");
      const before = await db.auditEntry.count({ where: { entityId: entity.id } });
      await expect(confirmPickup(kevin, handoff.id)).rejects.toMatchObject({ status: 403 });
      const after = await db.auditEntry.count({ where: { entityId: entity.id } });
      expect(after).toBe(before);
      const stillSent = await db.handoff.findUniqueOrThrow({ where: { id: handoff.id } });
      expect(stillSent.status).toBe("SENT");
    } finally {
      await cleanup(entity.id);
    }
  });

  it("confirming an already-confirmed handoff is rejected as a conflict", async () => {
    const { entity, handoff, adrian } = await throwawaySalesToOpsFixture();
    try {
      await confirmPickup(adrian, handoff.id);
      await expect(confirmPickup(adrian, handoff.id)).rejects.toMatchObject({ status: 409 });
    } finally {
      await cleanup(entity.id);
    }
  });
});

describe("Ops → CS send and Accept (brief 3.8.2, M8 AC1-AC9, AC11)", () => {
  async function throwawayOpsToCsEntity(stage: "BAU" | "UAT" = "BAU") {
    const adrian = await user("Adrian Koh");
    const entity = await db.entity.create({
      data: { legalName: "Throwaway Ops-CS Ltd", legalNameSearch: "throwaway ops-cs ltd", legalNameCore: "throwaway ops cs", ownerId: adrian.id, groupDecision: "STANDALONE", customerRole: { create: {} } },
    });
    await db.contractedProduct.create({
      data: { entityId: entity.id, contractingEntityId: entity.id, product: "UK_COP", country: "GB", stage, stageEnteredAt: new Date(), targetGoLive: new Date() },
    });
    await db.contact.create({
      data: { entityId: entity.id, context: "CUSTOMER", role: "INCIDENT", ownerTeams: ["OPS"], fullName: "Throwaway Incident Contact", email: "throwaway-incident@example.test" },
    });
    return { entity, adrian };
  }
  // Same append-only constraint as the Confirm-pickup block above: soft-delete, not hard-delete.
  async function cleanup(entityId: string) {
    await db.historyEvent.deleteMany({ where: { entityId } });
    await db.handoff.deleteMany({ where: { entityId } });
    await db.contact.deleteMany({ where: { entityId } });
    await db.contractedProduct.deleteMany({ where: { entityId } });
    await db.customerRole.deleteMany({ where: { entityId } });
    await db.entity.update({ where: { id: entityId }, data: { deletedAt: new Date() } });
  }

  it("AC1: blocked when no product has reached Ramp-up or BAU", async () => {
    const { entity, adrian } = await throwawayOpsToCsEntity("UAT");
    try {
      await expect(
        sendOpsToCs(adrian, entity.id, { blockNotes: {}, commitments: [], noOpenCommitments: true, confirmedContactIds: [], onboardingManagerId: (await user("Emma Wilson")).id }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      await cleanup(entity.id);
    }
  });

  it("AC2, AC5, AC9: sends once, blocks a second open handoff, and the CSM accepts to become owner", async () => {
    const { entity, adrian } = await throwawayOpsToCsEntity("BAU");
    const emma = await user("Emma Wilson");
    try {
      const sent = await sendOpsToCs(adrian, entity.id, { blockNotes: {}, commitments: [], noOpenCommitments: true, confirmedContactIds: [], onboardingManagerId: emma.id });
      const handoff = await db.handoff.findUniqueOrThrow({ where: { id: sent.id } });
      expect(handoff.status).toBe("SENT");
      expect(handoff.toUserId).toBe(emma.id);

      await expect(
        sendOpsToCs(adrian, entity.id, { blockNotes: {}, commitments: [], noOpenCommitments: true, confirmedContactIds: [], onboardingManagerId: emma.id }),
      ).rejects.toMatchObject({ status: 409 });

      const accepted = await acceptOpsToCs(emma, sent.id);
      expect(accepted.status).toBe("ACCEPTED");
      const entityAfter = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
      expect(entityAfter.ownerId).toBe(emma.id);
    } finally {
      await cleanup(entity.id);
    }
  });

  it("AC7: blocked with no active incident contact", async () => {
    const { entity, adrian } = await throwawayOpsToCsEntity("BAU");
    try {
      await db.contact.deleteMany({ where: { entityId: entity.id, role: "INCIDENT" } });
      await expect(
        sendOpsToCs(adrian, entity.id, { blockNotes: {}, commitments: [], noOpenCommitments: true, confirmedContactIds: [], onboardingManagerId: (await user("Emma Wilson")).id }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      await cleanup(entity.id);
    }
  });

  it("a forged accept by a non-recipient CS user returns 403 and writes nothing", async () => {
    const { entity, adrian } = await throwawayOpsToCsEntity("BAU");
    const emma = await user("Emma Wilson");
    const sophie = await user("Sophie Mitchell");
    try {
      const sent = await sendOpsToCs(adrian, entity.id, { blockNotes: {}, commitments: [], noOpenCommitments: true, confirmedContactIds: [], onboardingManagerId: emma.id });
      const before = await db.auditEntry.count({ where: { entityId: entity.id } });
      await expect(acceptOpsToCs(sophie, sent.id)).rejects.toMatchObject({ status: 403 });
      const after = await db.auditEntry.count({ where: { entityId: entity.id } });
      expect(after).toBe(before);
    } finally {
      await cleanup(entity.id);
    }
  });
});

describe("Owner-change integration with the issue flow (brief 4.9.7, M9 AC12) -- the real seeded Revolut Ltd / ISS-1038", () => {
  it("accepting a Revolut Ltd handoff to Emma Wilson changes ISS-1038's effective communicator, logged as a customer-owner change", async () => {
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const emma = await user("Emma Wilson");
    const originalOwnerId = revolut.ownerId;
    const originalOwnerSince = revolut.ownerSince;
    const iss1038 = await db.issue.findFirstOrThrow({ where: { number: 1038 } });

    const handoff = await db.handoff.create({
      data: { entityId: revolut.id, type: "OPS_TO_CS", status: "SENT", fromUserId: originalOwnerId!, toUserId: emma.id, sentAt: now(), snapshot: { v: 1, type: "OPS_TO_CS" } },
    });

    try {
      await acceptOpsToCs(emma, handoff.id);

      const entityAfter = await db.entity.findUniqueOrThrow({ where: { id: revolut.id } });
      expect(entityAfter.ownerId).toBe(emma.id);

      // HistoryEvent.summary (communicator-sync.ts) uses its own lowercase/parenthetical
      // phrasing; the brief's literal AC copy ("Communicator changed to Emma Wilson: customer
      // owner changed") is the IssueCommunication log line checked just below instead.
      const events = await db.historyEvent.findMany({ where: { entityId: revolut.id, issueId: iss1038.id }, orderBy: { createdAt: "desc" } });
      expect(events.some((e) => e.summary.includes(`communicator changed to ${emma.name} (customer owner changed)`))).toBe(true);

      const log = await db.issueCommunication.findFirst({ where: { issueId: iss1038.id, type: "SYSTEM", message: `Communicator changed to ${emma.name}: customer owner changed` } });
      expect(log).not.toBeNull();
    } finally {
      // Restore Revolut Ltd and ISS-1038 to their pre-test state so no other
      // test file in the same run (e.g. issues.test.ts's 7.1.17.8 oracle
      // checks, which assume Revolut's original owner) sees a changed entity.
      const iss1038Comm = await db.issueCommunication.findFirst({ where: { issueId: iss1038.id, type: "SYSTEM", message: { contains: `Communicator changed to ${emma.name}` } } });
      if (iss1038Comm) await db.issueCommunication.delete({ where: { id: iss1038Comm.id } });
      const iss1038Note = await db.issueNote.findFirst({ where: { issueId: iss1038.id, kind: "SYSTEM", body: { contains: `Communicator changed to ${emma.name}` } } });
      if (iss1038Note) await db.issueNote.delete({ where: { id: iss1038Note.id } });
      await db.historyEvent.deleteMany({ where: { entityId: revolut.id, issueId: iss1038.id, summary: { contains: "Communicator changed" } } });
      await db.historyEvent.deleteMany({ where: { entityId: revolut.id, handoffId: handoff.id } });
      // AuditEntry is append-only (a DB trigger blocks delete) -- the extra
      // rows this test wrote stay, same as every other test file's own
      // throwaway fixtures; they don't affect any other test's assertions,
      // which check current state, not historical audit-row counts.
      await db.handoff.delete({ where: { id: handoff.id } });
      await db.entity.update({ where: { id: revolut.id }, data: { ownerId: originalOwnerId, ownerSince: originalOwnerSince } });
    }
  });
});
