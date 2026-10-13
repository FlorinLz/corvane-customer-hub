import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { createAdminDb } from "@/server/db-admin";
import { mutate } from "@/server/audit/mutate";
import { createFields, updateFields } from "@/server/audit/record";
import { softDeleteEntity } from "@/server/services/entity-lifecycle";
import type { SessionUser } from "@/server/permissions/can";
import { normaliseCore, normaliseSearch } from "@/lib/validation/normalise";

/**
 * Brief 7.3.1 "services/audit.test.ts (database)". Exercises the real
 * `mutate()` transaction wrapper (brief 4.2.1) and the DB-level
 * immutability guarantees (M16 AC3) against the live dev database.
 *
 * Writes a throwaway fixture entity (admin client) to carry the test
 * audit/History rows, then soft-deletes it in afterAll via the real
 * softDeleteEntity() service — this both cleans it out of search,
 * worklists and group lists for anyone using the app afterwards, and
 * exercises softDeleteEntity() as a side effect. AuditEntry rows are
 * append-only by design (that is what this file tests), so the test's
 * audit trail itself cannot be deleted; a `db:reset` clears it like
 * everything else.
 */

const admin = createAdminDb();
let fixtureEntityId: string;
let adminUser: SessionUser;

beforeAll(async () => {
  const legalName = "ZZZ Audit Test Fixture (hidden after this test run)";
  const entity = await admin.entity.create({
    data: {
      legalName,
      legalNameSearch: normaliseSearch(legalName),
      legalNameCore: normaliseCore(legalName),
      type: "FINTECH",
      country: "GB",
    },
  });
  fixtureEntityId = entity.id;

  const adrian = await admin.user.findFirstOrThrow({ where: { isAdmin: true } });
  adminUser = { id: adrian.id, name: adrian.name, team: adrian.team, isAdmin: adrian.isAdmin, active: adrian.active };
});

afterAll(async () => {
  await softDeleteEntity(adminUser, fixtureEntityId, "Test fixture for audit.test.ts, safe to leave soft-deleted");
  await admin.$disconnect();
});

describe("mutate() (brief 4.2.1)", () => {
  it("writes one AuditEntry per changed field, sharing one actionId", async () => {
    await mutate(adminUser, { entityId: fixtureEntityId }, async (tx, log) => {
      await log.change({
        objectType: "LEGAL_ENTITY",
        objectId: fixtureEntityId,
        objectLabel: "Legal entity: ZZZ Audit Test Fixture",
        fields: updateFields({ Type: "Fintech", Country: "GB" }, { Type: "Bank", Country: "DE" }),
      });
    });

    const rows = await db.auditEntry.findMany({
      where: { entityId: fixtureEntityId, field: { in: ["Type", "Country"] } },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.actionId)).size).toBe(1);
    const typeRow = rows.find((r) => r.field === "Type")!;
    expect(typeRow.oldValue).toBe("Fintech");
    expect(typeRow.newValue).toBe("Bank");
  });

  it("a create (createFields, old === null) renders \"(none)\" as the stored old value", async () => {
    await mutate(adminUser, { entityId: fixtureEntityId }, async (tx, log) => {
      await log.change({
        objectType: "CONTACT",
        objectId: fixtureEntityId,
        objectLabel: "Contact: Test Contact (Incident)",
        fields: createFields({ "Full name": "Test Contact" }),
      });
    });
    const row = await db.auditEntry.findFirstOrThrow({
      where: { entityId: fixtureEntityId, field: "Full name" },
      orderBy: { createdAt: "desc" },
    });
    expect(row.oldValue).toBeNull(); // the UI renders a null oldValue as "(none)"
    expect(row.newValue).toBe("Test Contact");
  });

  it("a removal (newValue null) is stored as null, rendered \"(removed)\" by the UI", async () => {
    await mutate(adminUser, { entityId: fixtureEntityId }, async (tx, log) => {
      await log.change({
        objectType: "CONTACT",
        objectId: fixtureEntityId,
        objectLabel: "Contact: Test Contact (Incident)",
        fields: updateFields({ Phone: "+447700900000" }, { Phone: null as unknown as string }),
      });
    });
    const row = await db.auditEntry.findFirstOrThrow({
      where: { entityId: fixtureEntityId, field: "Phone" },
      orderBy: { createdAt: "desc" },
    });
    expect(row.oldValue).toBe("+447700900000");
    expect(row.newValue).toBeNull();
  });

  it("records the acting SessionUser's id, name and team as the actor on every entry, whichever user is signed in (demo \"View as\")", async () => {
    const network = await db.user.findFirstOrThrow({ where: { team: "NETWORK", active: true } });
    const networkUser: SessionUser = { id: network.id, name: network.name, team: network.team, isAdmin: false, active: true };

    await mutate(networkUser, { entityId: fixtureEntityId }, async (tx, log) => {
      await log.change({
        objectType: "LEGAL_ENTITY",
        objectId: fixtureEntityId,
        objectLabel: "Legal entity: ZZZ Audit Test Fixture",
        fields: createFields({ "Impersonation probe": "set by Network" }),
      });
    });

    const row = await db.auditEntry.findFirstOrThrow({
      where: { entityId: fixtureEntityId, field: "Impersonation probe" },
      orderBy: { createdAt: "desc" },
    });
    expect(row.userId).toBe(network.id);
    expect(row.userName).toBe(network.name);
    expect(row.userTeam).toBe("NETWORK");
  });

  it("writes a matching HistoryEvent in the same actionId as its audit entries", async () => {
    await mutate(adminUser, { entityId: fixtureEntityId }, async (tx, log) => {
      await log.change({
        objectType: "LEGAL_ENTITY",
        objectId: fixtureEntityId,
        objectLabel: "Legal entity: ZZZ Audit Test Fixture",
        fields: createFields({ "History probe": "value" }),
      });
      await log.history({ category: "OTHER_FIELD_CHANGES", summary: "History probe event" });
    });

    const auditRow = await db.auditEntry.findFirstOrThrow({ where: { entityId: fixtureEntityId, field: "History probe" } });
    const historyRow = await db.historyEvent.findFirstOrThrow({ where: { entityId: fixtureEntityId, summary: "History probe event" } });
    expect(historyRow.actionId).toBe(auditRow.actionId);
  });

  it("writes nothing when the callback throws — the whole transaction rolls back", async () => {
    const before = await db.auditEntry.count({ where: { entityId: fixtureEntityId, field: "Should not persist" } });
    await expect(
      mutate(adminUser, { entityId: fixtureEntityId }, async (tx, log) => {
        await log.change({
          objectType: "LEGAL_ENTITY",
          objectId: fixtureEntityId,
          objectLabel: "Legal entity: ZZZ Audit Test Fixture",
          fields: createFields({ "Should not persist": "value" }),
        });
        throw new Error("simulated mid-transaction failure");
      }),
    ).rejects.toThrow("simulated mid-transaction failure");

    const after = await db.auditEntry.count({ where: { entityId: fixtureEntityId, field: "Should not persist" } });
    expect(after).toBe(before);
  });
});

describe("AuditEntry immutability (M16 AC3)", () => {
  it("the app role (hub_app) cannot UPDATE an AuditEntry row", async () => {
    const row = await db.auditEntry.findFirstOrThrow({ where: { entityId: fixtureEntityId } });
    await expect(db.auditEntry.update({ where: { id: row.id }, data: { newValue: "tampered" } })).rejects.toThrow();
  });

  it("the app role (hub_app) cannot DELETE an AuditEntry row", async () => {
    const row = await db.auditEntry.findFirstOrThrow({ where: { entityId: fixtureEntityId } });
    await expect(db.auditEntry.delete({ where: { id: row.id } })).rejects.toThrow();
  });

  it("even the owner role cannot UPDATE or DELETE an AuditEntry row (the append-only trigger has no role exception)", async () => {
    const row = await admin.auditEntry.findFirstOrThrow({ where: { entityId: fixtureEntityId } });
    await expect(admin.auditEntry.update({ where: { id: row.id }, data: { newValue: "tampered" } })).rejects.toThrow();
    await expect(admin.auditEntry.delete({ where: { id: row.id } })).rejects.toThrow();
  });
});
