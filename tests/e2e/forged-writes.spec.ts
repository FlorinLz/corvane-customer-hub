import "dotenv/config";

import { test, expect, type APIRequestContext } from "@playwright/test";
import type { Team } from "@prisma/client";

import { signUserCookie, SESSION_COOKIE } from "@/server/session";
import { db } from "@/server/db";

/**
 * Brief 4.1.5, M15 AC9: a write outside the matrix returns 403 and writes
 * nothing, including no audit entry. This exercises the real HTTP routes
 * with forged cookies for every wrong team, against the live dev server
 * (milestone 3's e2e tests already rely on `reuseExistingServer`).
 */

const WRONG_TEAM_USERS: { label: string; email: string; team: Team }[] = [
  { label: "Sales", email: "tom.hadley@corvane.example", team: "SALES" },
  { label: "Ops (non-admin)", email: "kevin.lim@corvane.example", team: "OPS" },
  { label: "Customer Success", email: "emma.wilson@corvane.example", team: "CS" },
  { label: "Network", email: "lukas.brenner@corvane.example", team: "NETWORK" },
  { label: "Compliance", email: "mei.chen@corvane.example", team: "COMPLIANCE" },
  { label: "Finance", email: "rachel.wong@corvane.example", team: "FINANCE" },
];

/** Every team except the ones allowed to perform the action under test. */
function excludingTeams(...allowed: Team[]) {
  return WRONG_TEAM_USERS.filter((u) => !allowed.includes(u.team));
}

async function cookieFor(email: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return `${SESSION_COOKIE}=${signUserCookie(user.id)}`;
}

async function asUser(request: APIRequestContext, email: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, data?: unknown) {
  const cookie = await cookieFor(email);
  return request.fetch(path, { method, headers: { cookie, "Content-Type": "application/json" }, data });
}

/** Asserts the standard forbidden shape and that the audit log gained no rows for `objectId`. */
async function expectForbiddenAndNoWrite(res: Awaited<ReturnType<typeof asUser>>, objectId: string, auditCountBefore: number) {
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe("forbidden");
  const auditCountAfter = await db.auditEntry.count({ where: { objectId } });
  expect(auditCountAfter).toBe(auditCountBefore);
}

test.describe("Forged write/read requests (M15 AC9, M16 AC4)", () => {
  let monzoId: string;
  let monzoDeletedAtBefore: Date | null;

  test.beforeAll(async () => {
    const monzo = await db.entity.findFirstOrThrow({ where: { legalName: "Monzo Bank Ltd" } });
    monzoId = monzo.id;
    monzoDeletedAtBefore = monzo.deletedAt;
  });

  for (const { label, email } of WRONG_TEAM_USERS) {
    test(`${label} soft-deleting an entity returns 403 and writes nothing`, async ({ request }) => {
      const res = await asUser(request, email, "POST", `/api/entities/${monzoId}/delete`, { reason: "Forged request test, should be rejected" });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("forbidden");
      expect(body.owner_team).toBe("Ops");

      const after = await db.entity.findUniqueOrThrow({ where: { id: monzoId } });
      expect(after.deletedAt).toEqual(monzoDeletedAtBefore);
    });
  }

  for (const { label, email } of WRONG_TEAM_USERS) {
    test(`${label} reactivating an entity returns 403 and writes nothing`, async ({ request }) => {
      const lloydsLegacy = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank (legacy import)" } });
      const res = await asUser(request, email, "POST", `/api/entities/${lloydsLegacy.id}/reactivate`);
      expect(res.status()).toBe(403);
      const after = await db.entity.findUniqueOrThrow({ where: { id: lloydsLegacy.id } });
      expect(after.deletedAt).not.toBeNull(); // still deleted
    });
  }

  for (const { label, email } of WRONG_TEAM_USERS.filter((u) => u.label !== "Compliance")) {
    test(`${label} reading the audit log returns 403`, async ({ request }) => {
      const res = await asUser(request, email, "GET", `/api/entities/${monzoId}/audit`);
      expect(res.status()).toBe(403);
    });
  }

  test("Compliance reading the audit log succeeds (the one non-admin team allowed)", async ({ request }) => {
    const res = await asUser(request, "mei.chen@corvane.example", "GET", `/api/entities/${monzoId}/audit`);
    expect(res.ok()).toBe(true);
  });

  for (const { label, email } of WRONG_TEAM_USERS) {
    test(`${label} resetting demo data returns 403`, async ({ request }) => {
      const res = await asUser(request, email, "POST", "/api/demo/reset");
      expect(res.status()).toBe(403);
    });
  }

  for (const { label, email } of WRONG_TEAM_USERS) {
    test(`${label} reading the permission matrix returns 403`, async ({ request }) => {
      const res = await asUser(request, email, "GET", "/api/admin/permissions");
      if (label === "Compliance") {
        expect(res.ok()).toBe(true);
      } else {
        expect(res.status()).toBe(403);
      }
    });
  }

  for (const { label, email } of WRONG_TEAM_USERS) {
    test(`${label} reading deleted records returns 403`, async ({ request }) => {
      const res = await asUser(request, email, "GET", "/api/admin/deleted");
      expect(res.status()).toBe(403);
    });
  }

  // ───────────── Milestone 5: Details tab ─────────────

  test.describe("Edit roles (Ops only)", () => {
    for (const { label, email } of excludingTeams("OPS")) {
      test(`${label} setting roles returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null } });
        const before = await db.auditEntry.count({ where: { objectId: entity.id } });
        const res = await asUser(request, email, "PUT", `/api/entities/${entity.id}/roles`, { customer: true, partner: false, version: entity.version });
        await expectForbiddenAndNoWrite(res, entity.id, before);
      });
    }
  });

  test.describe("Attach contract (Ops only)", () => {
    for (const { label, email } of excludingTeams("OPS")) {
      test(`${label} attaching a contract returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null, customerRole: { active: true } } });
        const before = await db.contract.count();
        const res = await asUser(request, email, "PUT", `/api/entities/${entity.id}/contract`, {
          contractId: "FORGED-TEST-001",
          title: "Forged test contract",
          signingDate: "2026-01-01",
          scope: "ENTITY_CONTRACT",
          invoicedEntityId: entity.id,
          documentUrl: "https://docs.corvane-internal.example/forged.pdf",
          version: 0,
        });
        expect(res.status()).toBe(403);
        expect(await db.contract.count()).toBe(before);
      });
    }
  });

  test.describe("Link / Unlink entity to a group (Ops only)", () => {
    for (const { label, email } of excludingTeams("OPS")) {
      test(`${label} linking an entity returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null, groupId: null } });
        const group = await db.group.findFirstOrThrow();
        const res = await asUser(request, email, "PUT", `/api/entities/${entity.id}/group`, { groupId: group.id, version: entity.version });
        expect(res.status()).toBe(403);
        const after = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
        expect(after.groupId).toBeNull();
      });

      test(`${label} unlinking an entity returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null, groupId: { not: null } } });
        const res = await asUser(request, email, "DELETE", `/api/groups/${entity.groupId}/members/${entity.id}`, { version: entity.version });
        expect(res.status()).toBe(403);
        const after = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
        expect(after.groupId).toEqual(entity.groupId);
      });
    }
  });

  test.describe("Edit renewal date (CS only)", () => {
    for (const { label, email } of excludingTeams("CS")) {
      test(`${label} editing the renewal date returns 403 and writes nothing`, async ({ request }) => {
        const role = await db.customerRole.findFirstOrThrow({ where: { active: true } });
        const res = await asUser(request, email, "PUT", `/api/entities/${role.entityId}/renewal-date`, { renewalDate: "2027-06-01", version: role.version });
        expect(res.status()).toBe(403);
        const after = await db.customerRole.findUniqueOrThrow({ where: { id: role.id } });
        expect(after.version).toBe(role.version);
      });
    }
  });

  // ───────────── Milestone 5: Products tab ─────────────

  test.describe("Change stage / Mark as blocked / Resolve block (Ops only)", () => {
    for (const { label, email } of excludingTeams("OPS")) {
      test(`${label} changing stage returns 403 and writes nothing`, async ({ request }) => {
        const product = await db.contractedProduct.findFirstOrThrow({ where: { cancelledAt: null } });
        const res = await asUser(request, email, "POST", `/api/products/${product.id}/stage`, {
          toStage: "KICKOFF",
          entryDate: "2026-10-02",
          version: product.version,
        });
        expect(res.status()).toBe(403);
        const after = await db.contractedProduct.findUniqueOrThrow({ where: { id: product.id } });
        expect(after.version).toBe(product.version);
      });

      test(`${label} marking a product blocked returns 403 and writes nothing`, async ({ request }) => {
        const product = await db.contractedProduct.findFirstOrThrow({ where: { cancelledAt: null } });
        const res = await asUser(request, email, "PUT", `/api/products/${product.id}/block`, {
          blockedBy: "CUSTOMER",
          reason: "Forged request test, should be rejected",
          version: product.version,
        });
        expect(res.status()).toBe(403);
        const after = await db.contractedProduct.findUniqueOrThrow({ where: { id: product.id } });
        expect(after.blockedBy).toBeNull();
      });

      test(`${label} resolving a block returns 403 and writes nothing`, async ({ request }) => {
        const product = await db.contractedProduct.findFirstOrThrow({ where: { blockedBy: { not: null } } });
        const res = await asUser(request, email, "POST", `/api/products/${product.id}/block/resolve`, { version: product.version });
        expect(res.status()).toBe(403);
        const after = await db.contractedProduct.findUniqueOrThrow({ where: { id: product.id } });
        expect(after.blockedBy).not.toBeNull();
      });
    }
  });

  // ───────────── Milestone 5: Contacts tab ─────────────

  test.describe("Add / Edit / Verify contact (owner teams only)", () => {
    for (const { label, email } of excludingTeams("FINANCE")) {
      test(`${label} adding a Billing contact returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null } });
        const before = await db.contact.count();
        const res = await asUser(request, email, "POST", `/api/entities/${entity.id}/contacts`, {
          context: "CUSTOMER",
          role: "BILLING",
          fullName: "Forged Test Contact",
          email: "forged.test@example.com",
        });
        expect(res.status()).toBe(403);
        expect(await db.contact.count()).toBe(before);
      });
    }

    for (const { label, email } of excludingTeams("OPS")) {
      test(`${label} editing a Technical contact returns 403 and writes nothing`, async ({ request }) => {
        const contact = await db.contact.findFirstOrThrow({ where: { context: "CUSTOMER", role: "TECHNICAL", status: "ACTIVE" } });
        const res = await asUser(request, email, "PATCH", `/api/contacts/${contact.id}`, {
          context: contact.context,
          role: contact.role,
          fullName: contact.fullName,
          email: "changed@example.com",
          version: contact.version,
        });
        expect(res.status()).toBe(403);
        const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
        expect(after.email).toBe(contact.email);
      });

      test(`${label} marking a Technical contact verified returns 403 and writes nothing`, async ({ request }) => {
        const contact = await db.contact.findFirstOrThrow({ where: { context: "CUSTOMER", role: "TECHNICAL", status: "ACTIVE" } });
        const res = await asUser(request, email, "POST", `/api/contacts/${contact.id}/verify`, { version: contact.version });
        expect(res.status()).toBe(403);
        const after = await db.contact.findUniqueOrThrow({ where: { id: contact.id } });
        expect(after.version).toBe(contact.version);
      });
    }
  });

  // ───────────── Milestone 5: Partner tab ─────────────

  test.describe("Change coverage status (Network only)", () => {
    for (const { label, email } of excludingTeams("NETWORK")) {
      test(`${label} changing coverage status returns 403 and writes nothing`, async ({ request }) => {
        const coverage = await db.partnerCoverage.findFirstOrThrow();
        const res = await asUser(request, email, "POST", `/api/coverage/${coverage.id}/status`, {
          status: "DEGRADED",
          effectiveDate: "2026-10-02",
          reason: "Forged request test, should be rejected",
          version: coverage.version,
        });
        expect(res.status()).toBe(403);
        expect((await res.json()).owner_team).toBe("Network");
        const after = await db.partnerCoverage.findUniqueOrThrow({ where: { id: coverage.id } });
        expect(after.version).toBe(coverage.version);
      });
    }
  });

  // ───────────── Milestone 5: Compliance tab ─────────────

  test.describe("Licence verification and obligations (Compliance only)", () => {
    for (const { label, email } of excludingTeams("COMPLIANCE")) {
      test(`${label} saving a Licence KYB check returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null } });
        const before = await db.kybCheck.count();
        const res = await asUser(request, email, "PUT", `/api/entities/${entity.id}/kyb/LICENCE`, {
          licenceNumber: "FORGED-001",
          issuingAuthority: "Forged Authority",
          noExpiry: true,
          verifiedOn: "2026-10-02",
          evidenceUrl: "https://docs.corvane-internal.example/forged.pdf",
          version: 0,
        });
        expect(res.status()).toBe(403);
        expect(await db.kybCheck.count()).toBe(before);
      });

      test(`${label} saving the Customer agreement obligations returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null, customerRole: { active: true } } });
        const before = await db.obligationCard.count();
        const res = await asUser(request, email, "PUT", `/api/entities/${entity.id}/obligations/CUSTOMER_AGREEMENT`, { version: 0 });
        expect(res.status()).toBe(403);
        expect(await db.obligationCard.count()).toBe(before);
      });
    }
  });

  test.describe("Retry or refresh GLEIF (Ops or Compliance only)", () => {
    for (const { label, email } of excludingTeams("OPS", "COMPLIANCE")) {
      test(`${label} refreshing GLEIF returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null, lei: { not: null } } });
        const res = await asUser(request, email, "POST", `/api/entities/${entity.id}/gleif-refresh`);
        expect(res.status()).toBe(403);
        const after = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
        expect(after.gleifCheckedAt).toEqual(entity.gleifCheckedAt);
      });
    }
  });

  // ───────────── Milestone 5: Owner reassignment ─────────────

  test.describe("Reassign owner (CS only)", () => {
    for (const { label, email } of excludingTeams("CS")) {
      test(`${label} reassigning the owner returns 403 and writes nothing`, async ({ request }) => {
        const entity = await db.entity.findFirstOrThrow({ where: { deletedAt: null } });
        const csUser = await db.user.findFirstOrThrow({ where: { team: "CS", active: true } });
        const res = await asUser(request, email, "POST", `/api/entities/${entity.id}/owner`, {
          newOwnerId: csUser.id,
          reason: "Forged request test, should be rejected",
          expectedOwnerId: entity.ownerId,
        });
        expect(res.status()).toBe(403);
        const after = await db.entity.findUniqueOrThrow({ where: { id: entity.id } });
        expect(after.ownerId).toEqual(entity.ownerId);
      });
    }
  });

  test("Acknowledging someone else's owner assignment returns 403 and writes nothing", async ({ request }) => {
    const assignment = await db.ownerAssignment.findFirst({ where: { acknowledgedAt: null, supersededAt: null } });
    test.skip(!assignment, "No unacknowledged owner assignment in the seed");
    if (!assignment) return;
    const otherCsUser = await db.user.findFirstOrThrow({ where: { team: "CS", active: true, id: { not: assignment.assigneeId } } });
    const res = await asUser(request, otherCsUser.email, "POST", `/api/owner-assignments/${assignment.id}/acknowledge`);
    expect(res.status()).toBe(403);
    const after = await db.ownerAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.acknowledgedAt).toBeNull();
  });
});
