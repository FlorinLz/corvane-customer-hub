import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { now } from "@/lib/dates";
import {
  opsToPickUp,
  opsAwaitingAcceptance,
  opsBlocked,
  opsGoLives14Days,
  opsTooLongInStage,
  opsRequiredFieldsEmpty,
  ownershipAssignedToYou,
  csRenewals120Days,
  complianceKybAndReviewExpiries,
} from "@/server/queries/worklist/mine";

/**
 * Brief 7.3.1 "rules/worklists.test.ts", milestone 7, M11. Real seed
 * data for the Compliance section (7.1.17.8-adjacent oracle values
 * already fixed by the brief's own worked examples elsewhere, e.g.
 * E2E-3 step 1) and for the Ops/CS sections' real Revolut Ltd fixtures
 * (blocked line, too-long-in-stage line, go-live window); throwaway
 * fixtures everywhere a real-seed assertion would be too fragile.
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

describe("Ops sections (brief 4.6.2) -- against the real seeded Revolut Ltd", () => {
  it("M6 AC7, M11 AC7: Blocked lists Revolut's EU VoP / DE line, blocked by Customer", async () => {
    const adrian = await user("Adrian Koh");
    const rows = await opsBlocked(adrian.id);
    const revolutRow = rows.find((r) => r.entityName === "Revolut Ltd");
    expect(revolutRow).toBeDefined();
    expect(revolutRow?.blockedBy).toBe("CUSTOMER");
    expect(revolutRow?.daysBlocked).toBeGreaterThan(0);
  });

  it("M11 AC6: Too long in current stage lists Revolut's UK CoP / GB line (56-day limit at Live & hypercare)", async () => {
    const adrian = await user("Adrian Koh");
    const rows = await opsTooLongInStage(adrian.id);
    const revolutRow = rows.find((r) => r.entityName === "Revolut Ltd" && r.stage === "LIVE_HYPERCARE");
    expect(revolutRow).toBeDefined();
    expect(revolutRow!.daysInStage).toBeGreaterThan(revolutRow!.limitDays);
    expect(revolutRow!.limitDays).toBe(56);
  });

  it("M3 AC18, M11 AC8: Go-lives in the next 14 days lists Revolut's Global validation / SG line", async () => {
    const adrian = await user("Adrian Koh");
    const rows = await opsGoLives14Days(adrian.id);
    const revolutRow = rows.find((r) => r.entityName === "Revolut Ltd");
    expect(revolutRow).toBeDefined();
    expect(revolutRow!.daysUntil).toBeGreaterThanOrEqual(0);
    expect(revolutRow!.daysUntil).toBeLessThanOrEqual(14);
  });

  it("sorts Too long in current stage by the longest elapsed time first", async () => {
    const adrian = await user("Adrian Koh");
    const rows = await opsTooLongInStage(adrian.id);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].daysInStage).toBeGreaterThanOrEqual(rows[i].daysInStage);
    }
  });

  it("M2 AC19, M11 AC9: Required fields empty lists a throwaway customer missing LEI, type, country and contacts", async () => {
    const adrian = await user("Adrian Koh");
    const entity = await db.entity.create({
      data: {
        legalName: "Throwaway Worklist Required-Fields Ltd",
        legalNameSearch: "throwaway worklist required-fields ltd",
        legalNameCore: "throwaway worklist required fields",
        ownerId: adrian.id,
        groupDecision: "NOT_SET",
        customerRole: { create: {} },
      },
    });
    await db.contractedProduct.create({
      data: { entityId: entity.id, contractingEntityId: entity.id, product: "UK_COP", country: "GB", stage: "KICKOFF", stageEnteredAt: new Date(), targetGoLive: new Date() },
    });
    try {
      const rows = await opsRequiredFieldsEmpty(adrian.id);
      const row = rows.find((r) => r.entityId === entity.id);
      expect(row).toBeDefined();
      expect(row!.missing).toContain("LEI");
      expect(row!.missing).toContain("Entity type");
      expect(row!.missing).toContain("Country");
      expect(row!.missing).toContain("Active Technical contact");
      expect(row!.missing).toContain("Active Incident contact");
      expect(row!.missing).toContain("No contract attached");
      expect(row!.missing).toContain("Group not set");
    } finally {
      await db.contractedProduct.deleteMany({ where: { entityId: entity.id } });
      await db.customerRole.deleteMany({ where: { entityId: entity.id } });
      await db.entity.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
    }
  });

  it("M11 AC21: a soft-deleted entity never appears in Required fields empty", async () => {
    const adrian = await user("Adrian Koh");
    const entity = await db.entity.create({
      data: {
        legalName: "Throwaway Worklist Deleted Ltd",
        legalNameSearch: "throwaway worklist deleted ltd",
        legalNameCore: "throwaway worklist deleted",
        ownerId: adrian.id,
        groupDecision: "NOT_SET",
        customerRole: { create: {} },
        deletedAt: new Date(),
      },
    });
    try {
      const rows = await opsRequiredFieldsEmpty(adrian.id);
      expect(rows.some((r) => r.entityId === entity.id)).toBe(false);
    } finally {
      await db.customerRole.deleteMany({ where: { entityId: entity.id } });
    }
  });

  it("M3 AC11: To pick up and Awaiting acceptance return arrays with the expected shape (throwaway, no seeded Sent handoff addressed to Adrian for these rules)", async () => {
    const adrian = await user("Adrian Koh");
    const toPickUp = await opsToPickUp(adrian.id);
    const awaiting = await opsAwaitingAcceptance(adrian.id);
    expect(Array.isArray(toPickUp)).toBe(true);
    expect(Array.isArray(awaiting)).toBe(true);
  });
});

describe("\"Ownership assigned to you\" (brief 4.6.2/4.6.3/4.6.7, M9 AC9-AC11, M11 AC12) -- shared section, throwaway assignment", () => {
  it("lists an unacknowledged assignment and excludes a superseded one", async () => {
    const emma = await user("Emma Wilson");
    const adrian = await user("Adrian Koh");
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const a1 = await db.ownerAssignment.create({
      data: { entityId: revolut.id, assigneeId: emma.id, assignedById: adrian.id, previousOwnerId: adrian.id, reason: "Throwaway worklist test assignment" },
    });
    try {
      const rows = await ownershipAssignedToYou(emma.id);
      expect(rows.some((r) => r.assignmentId === a1.id)).toBe(true);

      await db.ownerAssignment.update({ where: { id: a1.id }, data: { supersededAt: now() } });
      const rowsAfter = await ownershipAssignedToYou(emma.id);
      expect(rowsAfter.some((r) => r.assignmentId === a1.id)).toBe(false);
    } finally {
      await db.ownerAssignment.delete({ where: { id: a1.id } });
    }
  });
});

describe("Customer Success sections (brief 4.6.3)", () => {
  it("M11 AC11: Renewals in the next 120 days includes a passed renewal date, labelled Overdue", async () => {
    const emma = await user("Emma Wilson");
    const entity = await db.entity.create({
      data: {
        legalName: "Throwaway Worklist Renewal Ltd",
        legalNameSearch: "throwaway worklist renewal ltd",
        legalNameCore: "throwaway worklist renewal",
        ownerId: emma.id,
        groupDecision: "STANDALONE",
        customerRole: { create: { renewalDate: new Date(now().getTime() - 10 * 86_400_000) } },
      },
    });
    try {
      const rows = await csRenewals120Days(emma.id);
      const row = rows.find((r) => r.entityId === entity.id);
      expect(row).toBeDefined();
      expect(row!.passed).toBe(true);
      expect(row!.daysUntil).toBeLessThan(0);
    } finally {
      await db.customerRole.deleteMany({ where: { entityId: entity.id } });
      await db.entity.update({ where: { id: entity.id }, data: { deletedAt: new Date() } });
    }
  });
});

describe("Compliance section (brief 4.6.4, M11 AC13) -- against the real seed's own documented oracle rows", () => {
  it("lists Banco Santander Consumer Portugal S.A. as Overdue, 'LEI lapsed in GLEIF'", async () => {
    const rows = await complianceKybAndReviewExpiries();
    const row = rows.find((r) => r.entityName === "Banco Santander Consumer Portugal S.A." && r.kind === "LEI");
    expect(row).toBeDefined();
    expect(row!.bucket).toBe("OVERDUE");
    expect(row!.label).toBe("LEI lapsed in GLEIF");
  });

  it("lists Banca Monte dei Paschi di Siena S.p.A.'s periodic review as Overdue, with a human-readable date (not the raw ISO string)", async () => {
    const rows = await complianceKybAndReviewExpiries();
    const row = rows.find((r) => r.entityName === "Banca Monte dei Paschi di Siena S.p.A." && r.kind === "REVIEW");
    expect(row).toBeDefined();
    expect(row!.bucket).toBe("OVERDUE");
    // The exact day is relative to seed time (`npm run demo:reset-data`'s own "today"), not
    // a fixed calendar date -- assert the formatted shape (DD Mon YYYY), not a pinned day.
    expect(row!.label).toMatch(/^Periodic review overdue since \d{2} \w{3} \d{4}$/);
  });

  it("sorts Overdue items before the 30/60/90-day buckets", async () => {
    const rows = await complianceKybAndReviewExpiries();
    const order: Record<string, number> = { OVERDUE: 0, WITHIN_30: 1, WITHIN_60: 2, WITHIN_90: 3 };
    for (let i = 1; i < rows.length; i++) {
      expect(order[rows[i - 1].bucket]).toBeLessThanOrEqual(order[rows[i].bucket]);
    }
  });
});
