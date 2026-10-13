import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";

import { ISSUES } from "../../../prisma/seed/data/issues";
import { PARTNER_ROLES } from "../../../prisma/seed/data/coverage";
import { ENTITIES } from "../../../prisma/seed/data/entities";

/**
 * The fuller Home worklists (ISS-1020 to ISS-1030): seed data only. Precondition as for seed.test.ts: the database has just been seeded.
 * Guards the three rules that keep the partner scenario (UK CoP / GB, Lloyds Bank plc) exactly as it was.
 */

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });
afterAll(async () => {
  await db.$disconnect();
});

const ORIGINAL = [1031, 1038, 1042];
const FORBIDDEN_ENTITIES = ["Revolut Ltd", "Lloyds Bank plc", "Santander UK plc", "Zopa Bank Limited", "Banca Monte dei Paschi di Siena S.p.A."];

const isWorklistIssue = (number: number) => !ORIGINAL.includes(number);

describe("Fuller Home worklists: what the new issues must not touch", () => {
  it("there are eleven new issues, ISS-1020 to ISS-1030, and the original three are unchanged in number", async () => {
    expect(ISSUES.filter((i) => isWorklistIssue(i.number)).map((i) => i.number).sort()).toEqual([1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030]);
    const stored = await db.issue.findMany({ select: { number: true }, orderBy: { number: "asc" } });
    expect(stored.map((i) => i.number)).toEqual([1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1038, 1042]);
  });

  it("rule 1: no new issue is on UK CoP / GB, or on Revolut, Lloyds, Santander UK, Zopa or Monte dei Paschi", async () => {
    const issues = await db.issue.findMany({ where: { number: { notIn: ORIGINAL } }, include: { entity: { select: { legalName: true } }, product: { select: { product: true, country: true } } } });
    expect(issues).toHaveLength(11);
    for (const i of issues) {
      expect(FORBIDDEN_ENTITIES, `ISS-${i.number} entity`).not.toContain(i.entity.legalName);
      expect(i.scheme === "UK_COP" && i.country === "GB", `ISS-${i.number} scheme/country`).toBe(false);
      expect(i.product?.product === "UK_COP" && i.product?.country === "GB", `ISS-${i.number} product line`).toBe(false);
    }
    // The seed data says the same, so a later edit cannot slip a forbidden issue in before the database is reseeded.
    const names = new Set((await db.entity.findMany({ where: { legalName: { in: FORBIDDEN_ENTITIES } }, select: { id: true } })).map((e) => e.id));
    expect((await db.issue.findMany({ where: { number: { notIn: ORIGINAL }, entityId: { in: [...names] } } })).length).toBe(0);
  });

  it("rule 2: no new issue is a partner issue on Lloyds Bank plc, none links to another, and none sits on UK CoP / GB where Affected customers looks", async () => {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    expect(await db.issue.count({ where: { entityId: lloyds.id } })).toBe(0);
    expect(await db.issueLink.count()).toBe(0);
    expect(await db.issue.count({ where: { scheme: "UK_COP", country: "GB", number: { notIn: ORIGINAL } } })).toBe(0);
  });

  it("rule 3: no partner coverage changes status; the coverages of the new partner issues are all Active and no status change was added", async () => {
    // Only the seeded partners: other specs create throwaway partner entities of their own.
    const seededNames = PARTNER_ROLES.map((r) => ENTITIES.find((e) => e.key === r.entity)!.legalName);
    const roles = await db.partnerRole.findMany({ where: { entity: { legalName: { in: seededNames } } }, include: { entity: { select: { legalName: true } }, coverage: { include: { statusChanges: true } } } });
    expect(roles).toHaveLength(PARTNER_ROLES.length);
    const stored = roles.reduce((sum, r) => sum + r.coverage.reduce((s, c) => s + c.statusChanges.length, 0), 0);
    const seeded = PARTNER_ROLES.reduce((sum, r) => sum + r.coverage.reduce((s, c) => s + c.changes.length, 0), 0);
    expect(stored).toBe(seeded);

    const partnerIssues = await db.issue.findMany({ where: { number: { notIn: ORIGINAL }, type: "PARTNER_DEGRADED" }, include: { entity: { select: { id: true } } } });
    expect(partnerIssues.map((i) => i.number).sort()).toEqual([1020, 1026, 1027, 1030]);
    for (const issue of partnerIssues) {
      const role = roles.find((r) => r.entityId === issue.entity.id)!;
      const coverage = role.coverage.find((c) => c.scheme === issue.scheme && c.country === issue.country)!;
      const latest = [...coverage.statusChanges].sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime() || b.createdAt.getTime() - a.createdAt.getTime())[0];
      expect(latest.status, `ISS-${issue.number}`).toBe("ACTIVE");
    }
  });
});
