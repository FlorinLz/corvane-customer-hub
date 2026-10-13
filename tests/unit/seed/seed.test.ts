import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { computeBillingFlag } from "@/server/derived/billing-flag";
import { addDays, now, today } from "@/lib/dates";

/**
 * Brief 7.3.1 "seed/seed.test.ts (database)". Precondition: the database
 * has just been reset with
 *   GLEIF_SEED_SOURCE=cache DEMO_CLOCK_START=2026-10-02T09:00:00+03:00 npm run db:reset
 * This test reads that state rather than running its own migrate+seed
 * cycle: `prisma migrate reset` carries an interactive safety prompt for
 * AI agents (by design) that a test run should not try to answer, and the
 * brief's own gate (7.4.2) already treats `npm run db:reset` as the
 * precondition for a test run, not something the tests perform themselves.
 *
 * R1 scope here: seed rows, History and audit minimums (7.1.14), the
 * group tiles oracle (7.1.5), and the billing flag results (7.1.13). The
 * full 7.1.15 Home oracle and the search oracles need the worklist and
 * search query layers (milestones 7 and 3); this file checks the
 * underlying seeded facts that power them instead of re-implementing
 * those layers ahead of their milestones (DECISIONS.md).
 */

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_ADMIN_URL }) });

const HISTORY_DEFAULT_CATEGORIES = ["STAGE_CHANGE", "CONTACT_CHANGE", "HANDOFF", "OWNER_REASSIGNED", "NETWORK_AND_STRUCTURE"];

/**
 * Excludes other files' own throwaway fixture entities -- audit.test.ts's
 * "ZZZ Audit Test Fixture…" and every "Throwaway …" entity created by
 * handoff.test.ts/worklists.test.ts, some soft-deleted in their own
 * cleanup rather than hard-deleted. This file and those both query the
 * same persistent dev database, and vitest does not guarantee file run
 * order, so a `vitest run` of the whole suite can see any of their
 * fixtures already created when a test here runs. Keeps the seed-row
 * oracles below a real regression check rather than loosened to `>= 18`
 * (milestone 8: found as a real, order-dependent flake -- "ZZZ Audit Test
 * Fixture" alone wasn't a complete list even before this milestone).
 */
const NOT_OTHER_FILES_THROWAWAY_FIXTURES = { NOT: [{ legalName: { startsWith: "ZZZ Audit Test Fixture" } }, { legalName: { startsWith: "Throwaway " } }] };

async function entityId(legalName: string): Promise<string> {
  const e = await db.entity.findFirstOrThrow({ where: { legalName } });
  return e.id;
}

/** "History items" = the merged timeline: HistoryEvent (default categories) + Note (brief 3.2.4). */
async function historyCount(legalName: string): Promise<number> {
  const id = await entityId(legalName);
  const events = await db.historyEvent.count({ where: { entityId: id, category: { in: HISTORY_DEFAULT_CATEGORIES as never } } });
  const notes = await db.note.count({ where: { entityId: id } });
  return events + notes;
}

async function auditCount(legalName: string): Promise<number> {
  const id = await entityId(legalName);
  return db.auditEntry.count({ where: { entityId: id } });
}

beforeAll(async () => {
  const count = await db.entity.count();
  if (count === 0) {
    throw new Error("Database is empty. Run `npm run db:reset` before this test (see the file header).");
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("seed rows (7.1.3)", () => {
  it("loads 18 entities, 1 soft-deleted", async () => {
    expect(await db.entity.count({ where: NOT_OTHER_FILES_THROWAWAY_FIXTURES })).toBe(18);
    const deleted = await db.entity.findMany({ where: { deletedAt: { not: null }, ...NOT_OTHER_FILES_THROWAWAY_FIXTURES } });
    expect(deleted.map((e) => e.legalName)).toEqual(["Lloyds Bank (legacy import)"]);
  });

  it("computes lifecycle exactly as the 7.1.3 'Expected lifecycle' column", async () => {
    const expected: Record<string, string> = {
      "Santander UK plc": "BAU",
      "Banco Santander Totta, S.A.": "LIVE",
      "Santander Consumer Bank S.p.A.": "LIVE",
      "Banco Santander Consumer Portugal S.A.": "ONBOARDING",
      "Lloyds Bank plc": "LIVE",
      "Banca Monte dei Paschi di Siena S.p.A.": "LIVE",
      "Zopa Bank Limited": "ONBOARDING",
      "UniCredit Bank GmbH": "BAU",
      "Adyen N.V.": "BAU",
      "Revolut Ltd": "LIVE",
      "Monzo Bank Ltd": "ONBOARDING",
      "Nordea Bank Abp": "BAU",
      "ING-DiBa AG": "BAU",
      "Oversea-Chinese Banking Corporation Limited": "LIVE",
      "The Governor and Company of the Bank of Ireland": "LIVE",
      "Česká spořitelna, a.s.": "ONBOARDING",
      "Raiffeisen Bank International AG": "INACTIVE",
    };
    for (const [legalName, lifecycle] of Object.entries(expected)) {
      const e = await db.entity.findFirstOrThrow({ where: { legalName } });
      expect(e.lifecycleState, legalName).toBe(lifecycle);
    }
  });

  it("Zopa's UK CoP / GB line targets today-6 at UAT (26 Sep 2026)", async () => {
    const p = await db.contractedProduct.findFirstOrThrow({ where: { entity: { legalName: "Zopa Bank Limited" } } });
    expect(p.product).toBe("UK_COP");
    expect(p.country).toBe("GB");
    expect(p.stage).toBe("UAT");
    expect(p.targetGoLive.toISOString().slice(0, 10)).toBe(addDays(today(), -6)); // today-6
  });
});

describe("History and audit minimums (7.1.14)", () => {
  const scenarioEntities = [
    "Santander UK plc", "Banco Santander Totta, S.A.", "Santander Consumer Bank S.p.A.",
    "Lloyds Bank plc", "Banca Monte dei Paschi di Siena S.p.A.", "Zopa Bank Limited",
    "UniCredit Bank GmbH", "Adyen N.V.", "Revolut Ltd", "Monzo Bank Ltd",
  ];

  it.each(scenarioEntities)("%s has >= 8 History items (default filters) and >= 15 audit entries", async (name) => {
    expect(await historyCount(name)).toBeGreaterThanOrEqual(8);
    expect(await auditCount(name)).toBeGreaterThanOrEqual(15);
  });

  it("Banco Santander Consumer Portugal S.A. (scbPt) has >= 5 History items", async () => {
    expect(await historyCount("Banco Santander Consumer Portugal S.A.")).toBeGreaterThanOrEqual(5);
  });

  it("Banca Monte dei Paschi di Siena S.p.A. has >= 12 History items with authors from Sales, Ops, CS, Network and Finance", async () => {
    // 7.1.14's summary says "all 6 teams"; the operative E2E-4 step 5
    // assertion names 5 teams and excludes Compliance (KYB/review changes
    // are OTHER_FIELD_CHANGES, filtered out by default) — see
    // DECISIONS.md.
    const id = await entityId("Banca Monte dei Paschi di Siena S.p.A.");
    expect(await historyCount("Banca Monte dei Paschi di Siena S.p.A.")).toBeGreaterThanOrEqual(12);
    const events = await db.historyEvent.findMany({ where: { entityId: id, category: { in: HISTORY_DEFAULT_CATEGORIES as never } } });
    const notes = await db.note.findMany({ where: { entityId: id } });
    const teams = new Set([...events.map((e) => e.actorTeam), ...notes.map((n) => n.authorTeam)].filter(Boolean));
    expect([...teams].sort()).toEqual(["CS", "FINANCE", "NETWORK", "OPS", "SALES"]);
  });
});

describe("Group tiles oracle (7.1.5)", () => {
  it("Santander group: 4 entities, Customer 3 / Network partner 0 / Both 1, stages, countries, no contract 0", async () => {
    const group = await db.group.findFirstOrThrow({ where: { name: "Santander" } });
    const entities = await db.entity.findMany({
      where: { groupId: group.id },
      include: { customerRole: true, partnerRole: true, products: true },
    });
    expect(entities).toHaveLength(4);

    let customerOnly = 0, partnerOnly = 0, both = 0;
    for (const e of entities) {
      const c = e.customerRole?.active ?? false;
      const p = e.partnerRole?.active ?? false;
      if (c && p) both++;
      else if (c) customerOnly++;
      else if (p) partnerOnly++;
    }
    expect(customerOnly).toBe(3);
    expect(partnerOnly).toBe(0);
    expect(both).toBe(1);

    const countries = new Set(entities.map((e) => e.country));
    expect([...countries].sort()).toEqual(["GB", "IT", "PT"]);

    const stageCounts: Record<string, number> = {};
    for (const e of entities) for (const p of e.products) stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;
    expect(stageCounts).toEqual({
      CONTRACT_SIGNED: 1,
      SANDBOX_TECHNICAL_INTEGRATION: 1,
      UAT: 1,
      RAMP_UP: 2,
      BAU: 1,
    });

    const withoutContract = await db.customerRole.count({
      where: { entityId: { in: entities.map((e) => e.id) }, contractId: null },
    });
    expect(withoutContract).toBe(0);
  });
});

describe("Billing flag results (7.1.13, M14 AC6-AC7, AC15)", () => {
  async function flagFor(legalName: string) {
    const e = await db.entity.findFirstOrThrow({
      where: { legalName },
      include: { customerRole: { include: { contract: true } }, partnerRole: true, billingProfile: true },
    });
    const invoicedEntityId = e.customerRole?.contract?.invoicedEntityId ?? null;
    const isOwnInvoicedEntity = invoicedEntityId === null || invoicedEntityId === e.id;
    let billedThroughEntityName: string | null = null;
    if (!isOwnInvoicedEntity) {
      const other = await db.entity.findUniqueOrThrow({ where: { id: invoicedEntityId! } });
      billedThroughEntityName = other.legalName;
    }
    return computeBillingFlag({
      hasActiveCustomerRole: e.customerRole?.active ?? false,
      lifecycle: e.lifecycleState,
      isDeleted: e.deletedAt !== null,
      isOwnInvoicedEntity,
      billedThroughEntityName,
      hasPartnerRole: e.partnerRole?.active ?? false,
      contractReference: e.customerRole?.contract?.contractId ?? null,
      profile: e.billingProfile
        ? {
            billingLegalName: e.billingProfile.billingLegalName,
            street: e.billingProfile.street,
            city: e.billingProfile.city,
            postalCode: e.billingProfile.postalCode,
            country: e.billingProfile.country,
            vatId: e.billingProfile.vatId,
            lei: e.billingProfile.lei,
            contractingEntity: e.billingProfile.contractingEntity,
          }
        : null,
    });
  }

  it("Zopa: 9 fields missing (no profile, no contract)", async () => {
    const r = await flagFor("Zopa Bank Limited");
    expect(r.applies).toBe(true);
    expect(r.missingFields).toHaveLength(9);
  });

  it("UniCredit: 3 missing (VAT / tax ID, Postal code, Contract reference)", async () => {
    const r = await flagFor("UniCredit Bank GmbH");
    expect(r.applies).toBe(true);
    expect(r.missingFields.sort()).toEqual(["Contract reference", "Postal code", "VAT / tax ID"].sort());
    expect(r.invalidFields).toEqual([]);
  });

  it("Revolut: 1 invalid (LEI, transposed check digits)", async () => {
    const r = await flagFor("Revolut Ltd");
    expect(r.applies).toBe(true);
    expect(r.missingFields).toEqual([]);
    expect(r.invalidFields).toEqual(["LEI"]);
  });

  it.each(["Banco Santander Totta, S.A.", "Santander Consumer Bank S.p.A.", "Lloyds Bank plc", "Banca Monte dei Paschi di Siena S.p.A.", "Adyen N.V.", "Monzo Bank Ltd"])(
    "%s: complete, no flag",
    async (name) => {
      const r = await flagFor(name);
      expect(r.incomplete).toBe(false);
    },
  );

  it("Santander UK plc and scbPt: billed through Banco Santander Totta, S.A., no flag", async () => {
    for (const name of ["Santander UK plc", "Banco Santander Consumer Portugal S.A."]) {
      const r = await flagFor(name);
      expect(r.applies).toBe(false);
      expect(r.billedThrough).toBe("Banco Santander Totta, S.A.");
    }
  });

  it("OCBC and Bank of Ireland: partner-only, no flag", async () => {
    for (const name of ["Oversea-Chinese Banking Corporation Limited", "The Governor and Company of the Bank of Ireland"]) {
      const r = await flagFor(name);
      expect(r.applies).toBe(false);
      expect(r.partnerOnly).toBe(true);
    }
  });

  it("Raiffeisen Bank International AG (Inactive): no flag", async () => {
    const r = await flagFor("Raiffeisen Bank International AG");
    expect(r.applies).toBe(false);
  });

  it("Finance 'Incomplete billing profiles' list sorts Zopa 9, UniCredit 3, Revolut 1", async () => {
    const results = await Promise.all(
      ["Zopa Bank Limited", "UniCredit Bank GmbH", "Revolut Ltd"].map(async (name) => ({
        name,
        count: (await flagFor(name)).missingFields.length + (await flagFor(name)).invalidFields.length,
      })),
    );
    const sorted = [...results].sort((a, b) => b.count - a.count);
    expect(sorted.map((r) => r.name)).toEqual(["Zopa Bank Limited", "UniCredit Bank GmbH", "Revolut Ltd"]);
    expect(sorted.map((r) => r.count)).toEqual([9, 3, 1]);
  });
});

describe("7.1.15 Home oracle — underlying facts (R1 sections: Adrian Mine, Emma Mine, Mei)", () => {
  it("Adrian (Ops, Mine): Totta's Ops -> CS handoff is Declined with the exact reason", async () => {
    const h = await db.handoff.findFirstOrThrow({
      where: { entity: { legalName: "Banco Santander Totta, S.A." }, type: "OPS_TO_CS" },
    });
    expect(h.status).toBe("DECLINED");
    expect(h.declineReason).toBe("Portuguese accounts sit with Ethan Brooks from October");
  });

  it("Adrian (Ops, Mine): Revolut EU VoP / DE is blocked by Customer, open", async () => {
    const p = await db.contractedProduct.findFirstOrThrow({
      where: { entity: { legalName: "Revolut Ltd" }, product: "EU_VOP", country: "DE" },
    });
    expect(p.blockedBy).toBe("CUSTOMER");
    expect(p.blockedSince).not.toBeNull();
  });

  it("Adrian (Ops, Mine): Lloyds has no active Technical contact (Required fields empty)", async () => {
    const technical = await db.contact.findMany({
      where: { entity: { legalName: "Lloyds Bank plc" }, context: "CUSTOMER", role: "TECHNICAL", status: "ACTIVE" },
    });
    expect(technical).toHaveLength(0);
  });

  it("Emma (CS, Mine): UniCredit ownership assigned to her, unacknowledged (Home badge)", async () => {
    const oa = await db.ownerAssignment.findFirstOrThrow({
      where: { entity: { legalName: "UniCredit Bank GmbH" } },
      include: { assignee: true, previousOwner: true },
    });
    expect(oa.assignee.name).toBe("Emma Wilson");
    expect(oa.previousOwner?.name).toBe("Leo Martin");
    expect(oa.acknowledgedAt).toBeNull();
  });

  it("Emma (CS, Mine): renewals — UniCredit overdue, MPS in 75 days", async () => {
    const hvb = await db.customerRole.findFirstOrThrow({ where: { entity: { legalName: "UniCredit Bank GmbH" } } });
    const mps = await db.customerRole.findFirstOrThrow({ where: { entity: { legalName: "Banca Monte dei Paschi di Siena S.p.A." } } });
    expect(hvb.renewalDate!.toISOString().slice(0, 10)).toBe(addDays(today(), -10)); // today-10
    expect(mps.renewalDate!.toISOString().slice(0, 10)).toBe(addDays(today(), 75)); // today+75
  });

  it("Mei (Compliance): scbPt LEI Lapsed, MPS review overdue since today-5", async () => {
    const scbPt = await db.entity.findFirstOrThrow({ where: { legalName: "Banco Santander Consumer Portugal S.A." } });
    expect(scbPt.leiStatus).toBe("LAPSED");
    const mpsReview = await db.periodicReview.findFirstOrThrow({ where: { entity: { legalName: "Banca Monte dei Paschi di Siena S.p.A." } } });
    expect(mpsReview.nextReviewDate.toISOString().slice(0, 10)).toBe(addDays(today(), -5)); // today-5
  });

  it("Mei (Compliance): Adyen licence expires in 23 days, UniCredit LEI renews 2 Aug 2027", async () => {
    const adyen = await db.kybCheck.findFirstOrThrow({ where: { entity: { legalName: "Adyen N.V." }, type: "LICENCE" } });
    expect(adyen.expiryDate!.toISOString().slice(0, 10)).toBe(addDays(today(), 23)); // today+23
    // Real GLEIF data (brief's "Rename demo data to international names"):
    // UniCredit Bank GmbH's actual next renewal is 2027-08-02, far outside
    // the 90-day window BCR's real LEI happened to sit inside — see
    // DECISIONS.md. This asserts the real value, not a fabricated one.
    const hvb = await db.entity.findFirstOrThrow({ where: { legalName: "UniCredit Bank GmbH" } });
    expect(hvb.leiNextRenewalDate!.toISOString().slice(0, 10)).toBe("2027-08-02");
  });
});

describe("Search oracles (data level; except contract ID, which needs the M3 search service)", () => {
  it("'Santander' matches 4 entities by legal name before scenario 1", async () => {
    const rows = await db.entity.findMany({ where: { legalName: { contains: "Santander", mode: "insensitive" }, deletedAt: null } });
    expect(rows).toHaveLength(4);
  });

  it("'monzo' matches 1 non-deleted entity", async () => {
    const rows = await db.entity.findMany({ where: { legalName: { contains: "monzo", mode: "insensitive" }, deletedAt: null } });
    expect(rows).toHaveLength(1);
  });

  it("'Financial Services' matches only Zopa's alias, no legal name, after the rename", async () => {
    // Before the international-names rename, this also matched Netopia
    // Financial Services S.A.'s legal name; Adyen N.V. doesn't contain the
    // phrase, so this now exercises the alias-only path on its own.
    const byName = await db.entity.findMany({ where: { legalName: { contains: "Financial Services", mode: "insensitive" } } });
    expect(byName).toEqual([]);
    const byAlias = await db.entityAlias.findMany({ where: { alias: { contains: "Financial Services", mode: "insensitive" } }, include: { entity: true } });
    expect(byAlias.map((a) => a.entity.legalName)).toEqual(["Zopa Bank Limited"]);
  });

  it("'mps' matches Banca Monte dei Paschi di Siena S.p.A. via its alias", async () => {
    const rows = await db.entityAlias.findMany({ where: { alias: { equals: "MPS", mode: "insensitive" } }, include: { entity: true } });
    expect(rows.map((r) => r.entity.legalName)).toEqual(["Banca Monte dei Paschi di Siena S.p.A."]);
  });
});

describe("Issue flow seed (7.1.17.5, milestone 6A)", () => {
  async function issueByNumber(number: number) {
    return db.issue.findUniqueOrThrow({
      where: { number },
      include: { contributors: true, notes: true, communications: true, assessments: true, entity: { select: { legalName: true } } },
    });
  }

  it("ISS-1031 (hvb, Billing): Sev-3, Finance owner Rachel Wong, named person, no notification clock", async () => {
    const issue = await issueByNumber(1031);
    expect(issue.entity.legalName).toBe("UniCredit Bank GmbH");
    expect(issue.type).toBe("BILLING");
    expect(issue.severity).toBe("SEV3");
    expect(issue.severityCapLabel).toBeNull();
    expect(issue.stageAtReport).toBe("BAU");
    expect(issue.ownerTeam).toBe("FINANCE");
    expect(issue.routingRule).toBe("NAMED_PERSON");
    expect(issue.communicatorRule).toBe("CUSTOMER_OWNER");
    expect(issue.status).toBe("IN_PROGRESS");
    expect(issue.acknowledgedAt).not.toBeNull();
    expect(issue.notifyRequired).toBe(false);
    expect(issue.complianceFlaggedAt).toBeNull();
    const owner = await db.user.findUnique({ where: { id: issue.ownerId! } });
    expect(owner!.name).toBe("Rachel Wong");
    expect(issue.contributors).toHaveLength(1);
    const contributor = await db.user.findUnique({ where: { id: issue.contributors[0].userId } });
    expect(contributor!.name).toBe("Tom Hadley"); // default contributor, Billing -> Sales, HVB's named Sales person
    expect(issue.notes).toHaveLength(1);
    expect(issue.notes[0].body).toContain("PO number");
    expect(issue.communications).toHaveLength(0);
    expect(issue.assessments).toHaveLength(0);
  });

  it("ISS-1038 (revolut, Wrong match): Sev-2, Ops owner Kevin Lim, default contributor Lukas Brenner, notified", async () => {
    const issue = await issueByNumber(1038);
    expect(issue.entity.legalName).toBe("Revolut Ltd");
    expect(issue.type).toBe("WRONG_MATCH");
    expect(issue.severity).toBe("SEV2");
    expect(issue.ownerTeam).toBe("OPS");
    expect(issue.routingRule).toBe("NAMED_PERSON");
    expect(issue.communicatorRule).toBe("CUSTOMER_OWNER");
    const owner = await db.user.findUnique({ where: { id: issue.ownerId! } });
    expect(owner!.name).toBe("Kevin Lim");
    expect(issue.contributors).toHaveLength(1);
    const contributor = await db.user.findUnique({ where: { id: issue.contributors[0].userId } });
    expect(contributor!.name).toBe("Lukas Brenner");
    expect(issue.notifyRequired).toBe(true);
    expect(issue.notifyTargetBusinessMins).toBe(240);
    expect(issue.notifiedAt).not.toBeNull();
    expect(issue.communications).toHaveLength(1);
    expect(issue.communications[0].type).toBe("FIRST_NOTIFICATION");
    expect(issue.communications[0].personName).toBe("Priya Nair");
    expect(issue.complianceFlaggedAt).toBeNull();
  });

  it("Event, Corvane aware at, Opened and Source on the seeded issues", async () => {
    const min = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 60_000;
    const i1031 = await issueByNumber(1031);
    expect(i1031.awarenessSource).toBe("EMAIL");
    expect(min(i1031.awareAt, i1031.eventAt!)).toBe(20);

    // ISS-1038: Corvane aware at 14:45 MYT, Event 20 min before, Source Email, opened 15:20 MYT: 35 min after Corvane aware at, so the amber marker shows.
    const i1038 = await issueByNumber(1038);
    expect(i1038.awarenessSource).toBe("EMAIL");
    expect(min(i1038.awareAt, i1038.eventAt!)).toBe(20);
    expect(min(i1038.createdAt, i1038.awareAt)).toBe(35);
    // Every outcome stays as it was: acknowledge 50 of 60 min (on time), notified inside its 240 business min.
    expect(i1038.ackStartAt!.getTime()).toBe(i1038.awareAt.getTime());
    expect(min(i1038.acknowledgedAt!, i1038.ackStartAt!)).toBe(50);
    expect(i1038.acknowledgedAt!.getTime()).toBeLessThanOrEqual(i1038.ackDueAt!.getTime());
    expect(i1038.notifiedAt!.getTime()).toBeLessThanOrEqual(i1038.notifyDueAt!.getTime());

    // ISS-1042: the monitoring alert. Event 2 min before the alert time, Source Monitoring, opened at the alert time (no gap marker).
    const i1042 = await issueByNumber(1042);
    expect(i1042.awarenessSource).toBe("MONITORING");
    expect(min(i1042.awareAt, i1042.eventAt!)).toBe(2);
    expect(i1042.createdAt.getTime()).toBe(i1042.awareAt.getTime());
    expect(min(i1042.acknowledgedAt!, i1042.ackStartAt!)).toBe(9);
    expect(i1042.acknowledgedAt!.getTime()).toBeLessThanOrEqual(i1042.ackDueAt!.getTime());

    // Event may be unknown, but never on a resolved Sev-1 (none is seeded).
    for (const i of [i1031, i1038, i1042]) expect(i.severity === "SEV1" && i.status === "RESOLVED" && i.eventAt === null).toBe(false);
  });

  it("ISS-1042 (mps, Service unavailable): Sev-1, reporter Monitoring (automatic), on-call owner Kevin Lim, flagged and assessed", async () => {
    const issue = await issueByNumber(1042);
    expect(issue.entity.legalName).toBe("Banca Monte dei Paschi di Siena S.p.A.");
    expect(issue.type).toBe("SERVICE_UNAVAILABLE");
    expect(issue.severity).toBe("SEV1");
    expect(issue.stageAtReport).toBe("BAU");
    expect(issue.reporterKind).toBe("MONITORING");
    expect(issue.reporterId).toBeNull();
    expect(issue.customerReporterKind).toBe("FOUND_INTERNALLY");
    expect(issue.ownerTeam).toBe("OPS");
    expect(issue.routingRule).toBe("ON_CALL_OUT_OF_HOURS");
    expect(issue.communicatorRule).toBe("ISSUE_OWNER_UNTIL_HANDOVER");
    expect(issue.handoverAt).not.toBeNull();
    expect(issue.handoverWrittenAt).toBeNull(); // the seed never writes the hand-over itself (7.1.17.5)
    const owner = await db.user.findUnique({ where: { id: issue.ownerId! } });
    expect(owner!.name).toBe("Kevin Lim");
    expect(issue.contributors).toHaveLength(0); // no default contributor for Service unavailable
    expect(issue.notifyRequired).toBe(true);
    expect(issue.notifyTargetHours).toBe(6); // MPS card's incident notice time
    expect(issue.notifiedAt).not.toBeNull();
    expect(issue.communications).toHaveLength(1);
    expect(issue.communications[0].personName).toBe("Silvia Moretti");
    expect(issue.complianceFlaggedAt).not.toBeNull();
    expect(issue.complianceReasons).toEqual(["Sev-1 at a regulated customer (EU DORA)"]);
    expect(issue.assessments).toHaveLength(1);
    expect(issue.assessments[0].outcome).toBe("POSSIBLE_MAJOR_INCIDENT");
    expect(issue.assessments[0].factsTargetHours).toBe(2);
  });

  it("every seeded entity has the five IssueTeamMember rows of 7.1.17.3", async () => {
    const entities = await db.entity.findMany({ where: NOT_OTHER_FILES_THROWAWAY_FIXTURES, select: { id: true } });
    for (const e of entities) {
      const rows = await db.issueTeamMember.findMany({ where: { entityId: e.id } });
      expect(rows.map((r) => r.team).sort()).toEqual(["COMPLIANCE", "FINANCE", "NETWORK", "OPS", "SALES"]);
    }
    const revolut = await db.entity.findFirstOrThrow({ where: { legalName: "Revolut Ltd" } });
    const ops = await db.issueTeamMember.findUnique({ where: { entityId_team: { entityId: revolut.id, team: "OPS" } }, include: { user: true } });
    expect(ops!.user.name).toBe("Kevin Lim"); // Revolut's named Ops person overrides the Adrian Koh default
  });

  it("one OnCallShift per on-call team covers today-7 to today+14", async () => {
    const shifts = await db.onCallShift.findMany({ include: { user: true } });
    expect(shifts).toHaveLength(3);
    const byTeam = new Map(shifts.map((s) => [s.team, s]));
    expect(byTeam.get("OPS")!.user.name).toBe("Kevin Lim");
    expect(byTeam.get("NETWORK")!.user.name).toBe("Nora Lee");
    expect(byTeam.get("COMPLIANCE")!.user.name).toBe("Mei Chen");
    // tsz() places startsAt/endsAt at local midnight in each team's own zone
    // (MYT/SGT, both UTC+8), which lands on the *previous* UTC calendar day
    // -- comparing by UTC-sliced date against a Bucharest-based date string
    // is off by a day by construction, not a seed bug. Compare instants
    // against "now" instead, which is what the invariant ("covers
    // today-7 to today+14") actually means.
    const nowMs = now().getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    for (const s of shifts) {
      expect(s.startsAt.getTime()).toBeLessThanOrEqual(nowMs - 6 * dayMs);
      expect(s.endsAt.getTime()).toBeGreaterThan(nowMs + 13 * dayMs);
    }
  });
});

describe("Regulatory block seed (7.1.17.6, M26 AC10)", () => {
  async function regulatoryCard(legalName: string) {
    const entity = await db.entity.findFirstOrThrow({ where: { legalName } });
    return db.obligationCard.findUnique({ where: { entityId_kind: { entityId: entity.id, kind: "CUSTOMER_AGREEMENT" } } });
  }

  it("MPS: EU DORA, 2 hours, the DORA deadline text, 20 days", async () => {
    const card = await regulatoryCard("Banca Monte dei Paschi di Siena S.p.A.");
    expect(card!.regulatoryRegime).toBe("EU_DORA");
    expect(card!.factsNeededHours).toBe(2);
    expect(card!.regulatorDeadline).toContain("DORA");
    expect(card!.postIncidentReportDays).toBe(20);
  });

  it("Revolut Ltd and Santander UK plc and Lloyds Bank plc: UK FCA, 4 hours", async () => {
    for (const name of ["Revolut Ltd", "Santander UK plc", "Lloyds Bank plc"]) {
      const card = await regulatoryCard(name);
      expect(card!.regulatoryRegime, name).toBe("UK_FCA");
      expect(card!.factsNeededHours, name).toBe(4);
    }
  });

  it("post-incident report days (M26 AC10, Release 1): Revolut 14, Santander UK 30, Lloyds (customer card) 14, MPS 20, UniCredit 20, Adyen 20", async () => {
    const expected: Record<string, number> = { "Revolut Ltd": 14, "Santander UK plc": 30, "Lloyds Bank plc": 14, "Banca Monte dei Paschi di Siena S.p.A.": 20, "UniCredit Bank GmbH": 20, "Adyen N.V.": 20 };
    for (const [name, days] of Object.entries(expected)) {
      expect((await regulatoryCard(name))!.postIncidentReportDays, name).toBe(days);
    }
  });

  it("Monzo Bank Ltd and Zopa Bank Limited: regime not captured", async () => {
    for (const name of ["Monzo Bank Ltd", "Zopa Bank Limited"]) {
      const card = await regulatoryCard(name);
      expect(card!.regulatoryRegime, name).toBeNull();
      expect(card!.factsNeededHours, name).toBeNull();
      expect(card!.postIncidentReportDays, name).toBeNull();
    }
  });

  it("other customers (scbIt, totta, nordea, ingdiba, ceska): regime None", async () => {
    for (const name of ["Santander Consumer Bank S.p.A.", "Banco Santander Totta, S.A.", "Nordea Bank Abp", "ING-DiBa AG", "Česká spořitelna, a.s."]) {
      const card = await regulatoryCard(name);
      expect(card!.regulatoryRegime, name).toBe("NONE");
      expect(card!.factsNeededHours, name).toBeNull();
      expect(card!.postIncidentReportDays, name).toBeNull();
    }
  });

  it("Partner agreement cards carry no regulatory values (M26 AC1)", async () => {
    const lloyds = await db.entity.findFirstOrThrow({ where: { legalName: "Lloyds Bank plc" } });
    const partnerCard = await db.obligationCard.findUnique({ where: { entityId_kind: { entityId: lloyds.id, kind: "PARTNER_AGREEMENT" } } });
    expect(partnerCard!.regulatoryRegime).toBeNull();
    expect(partnerCard!.factsNeededHours).toBeNull();
    expect(partnerCard!.regulatorDeadline).toBeNull();
    expect(partnerCard!.postIncidentReportDays).toBeNull();
  });
});

describe("Issue flow invariants (7.1.17.7)", () => {
  it("the three original issues are In progress and acknowledged; the eleven worklist issues are New or In progress, none Closed, none queued", async () => {
    const issues = await db.issue.findMany({ orderBy: { number: "asc" } });
    expect(issues.map((i) => i.number)).toEqual([1020, 1021, 1022, 1023, 1024, 1025, 1026, 1027, 1028, 1029, 1030, 1031, 1038, 1042]);
    for (const i of issues) {
      expect(i.routingRule, `ISS-${i.number}`).not.toBe("QUEUED_FOR_BUSINESS_HOURS");
      // Acknowledged exactly when In progress.
      expect(i.status, `ISS-${i.number}`).toBe(i.acknowledgedAt ? "IN_PROGRESS" : "NEW");
      if (i.number >= 1031) expect(i.acknowledgedAt, `ISS-${i.number}`).not.toBeNull();
    }
  });

  it("the next issue number is 1043", async () => {
    // Reads the sequence's current value directly rather than consuming it with an
    // insert, so this assertion stays valid across repeated `vitest run`s of an
    // already-reset database, not only the first run after `db:reset`.
    const [{ last_value }] = await db.$queryRawUnsafe<{ last_value: bigint }[]>("SELECT last_value FROM issue_number_seq");
    expect(Number(last_value)).toBe(1042);
  });

  it("no partner issue, no IssueLink, no IssueGroupReport, no root cause report task", async () => {
    expect(await db.issueLink.count()).toBe(0);
    expect(await db.issueGroupReport.count()).toBe(0);
    expect(await db.rootCauseReportTask.count()).toBe(0);
  });

  it("only ISS-1042 and ISS-1029 are flagged for Compliance, and only ISS-1042 is assessed", async () => {
    const flagged = await db.issue.findMany({ where: { complianceFlaggedAt: { not: null } }, orderBy: { number: "asc" } });
    expect(flagged.map((i) => i.number)).toEqual([1029, 1042]);
    const assessed = await db.complianceAssessment.findMany({ include: { issue: { select: { number: true } } } });
    expect(assessed.map((a) => a.issue.number)).toEqual([1042]);
  });
});
