import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { snapshotInputHash } from "../../scripts/demo-snapshot-lib";
import { buildRestoreSql, demoSnapshot, type DemoSnapshot } from "@/server/demo-snapshot";
import { ConflictError } from "@/server/errors";
import { RESTORE_LOCK_KEY, resetDemoData, restoreFromSnapshot } from "@/server/demo-reset";

// The seed is replaced for the "a failed restore keeps the previous data" test; everything else here uses the real modules.
const seedMock = vi.hoisted(() => vi.fn<(db: unknown) => Promise<void>>());
vi.mock("@seed/seed", () => ({ seed: seedMock }));

describe("the demo snapshot is current", () => {
  it("matches the seed, the schema, the migrations and the GLEIF cache it was generated from", () => {
    expect(
      demoSnapshot.inputHash,
      "data/demo-snapshot.js is stale: something the seed reads has changed. Run `npm run demo:snapshot` (local Docker database) and commit the result.",
    ).toBe(snapshotInputHash());
  });
});

describe("buildRestoreSql", () => {
  it("is one parameterless script: truncate, one insert per non-empty table, then the issue number sequence", () => {
    const snapshot: DemoSnapshot = {
      version: 1,
      seedToday: "2026-10-05",
      inputHash: "x",
      issueNumberNext: 1050,
      tables: [
        { name: "A", rows: [{ id: "1", note: "has $snap0$ inside" }] },
        { name: "B", rows: [] },
      ],
    };
    const sql = buildRestoreSql(snapshot);
    expect(sql.startsWith('TRUNCATE TABLE "A", "B" RESTART IDENTITY CASCADE;')).toBe(true);
    expect(sql).toContain('INSERT INTO "A" SELECT * FROM jsonb_populate_recordset(null::"A", $snap1$');
    expect(sql).not.toContain('INSERT INTO "B"');
    expect(sql.trim().endsWith("SELECT setval('issue_number_seq', 1050, false)")).toBe(true);
  });
});

// The database tests run in a throwaway database made from the baseline migration, so they never touch the shared dev database
// the other test files assert against.
const adminUrl = process.env.DATABASE_ADMIN_URL ?? "";
const scratchName = `customer_hub_snapshot_test_${process.pid}`;
const scratchUrl = adminUrl.replace(/\/[^/?]+(\?|$)/, `/${scratchName}$1`);
let scratch: PrismaClient;

async function withMaintenance<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function counts(db: PrismaClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of demoSnapshot.tables) out[t.name] = Number((await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t.name}"`))[0].n);
  return out;
}

describe("restoring the snapshot", () => {
  beforeAll(async () => {
    await withMaintenance((c) => c.query(`CREATE DATABASE "${scratchName}"`));
    const c = new Client({ connectionString: scratchUrl });
    await c.connect();
    await c.query(readFileSync(resolve(__dirname, "../../prisma/migrations/20261010000000_baseline/migration.sql"), "utf-8"));
    await c.end();
    scratch = new PrismaClient({ adapter: new PrismaPg({ connectionString: scratchUrl, max: 1 }) });
  }, 60_000);

  afterAll(async () => {
    await scratch?.$disconnect();
    await withMaintenance((c) => c.query(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`));
  });

  it("covers every data table and gives the same row counts as the snapshot", async () => {
    const tables = (await scratch.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((r) => r.tablename);
    const data = tables.filter((t) => !["DemoMeta", "_prisma_migrations"].includes(t)).sort();
    expect(demoSnapshot.tables.map((t) => t.name).sort(), "a table is missing from the snapshot: run `npm run demo:snapshot`").toEqual(data);

    const version = await restoreFromSnapshot(scratchUrl);
    expect(version).toBe(1);
    const got = await counts(scratch);
    for (const t of demoSnapshot.tables) expect(got[t.name], t.name).toBe(t.rows.length);
    const [{ next }] = await scratch.$queryRaw<{ next: bigint }[]>`SELECT nextval('issue_number_seq') AS next`;
    expect(Number(next)).toBe(demoSnapshot.issueNumberNext);
    expect(await restoreFromSnapshot(scratchUrl)).toBe(2); // restoring again replaces, and bumps seedVersion
    expect(await counts(scratch)).toEqual(got);
  }, 60_000);

  it("a restore that fails leaves the previous data intact", async () => {
    const before = await counts(scratch);
    const broken: DemoSnapshot = {
      ...demoSnapshot,
      // The last table gets a row that breaks its foreign keys, after everything before it was already truncated and re-inserted.
      tables: demoSnapshot.tables.map((t, i, all) =>
        i === all.length - 1 ? { ...t, rows: [{ ...(demoSnapshot.tables.find((x) => x.rows.length && x.name !== t.name)!.rows[0]) }] } : t,
      ),
    };
    await expect(restoreFromSnapshot(scratchUrl, broken)).rejects.toThrow();
    expect(await counts(scratch)).toEqual(before);
  }, 60_000);

  it("a seed that fails midway leaves the previous data intact", async () => {
    const before = await counts(scratch);
    // By the time the seed runs, every table has already been truncated in the same transaction.
    seedMock.mockImplementationOnce(async () => {
      throw new Error("seed failed halfway");
    });
    await expect(resetDemoData(scratch)).rejects.toThrow("seed failed halfway");
    expect(await counts(scratch)).toEqual(before);
  }, 60_000);

  it("two restores never run at once: the second fails fast and changes nothing", async () => {
    const before = await counts(scratch);
    const holder = new Client({ connectionString: scratchUrl });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      await holder.query(`SELECT pg_advisory_xact_lock(${RESTORE_LOCK_KEY})`);
      await expect(restoreFromSnapshot(scratchUrl)).rejects.toBeInstanceOf(ConflictError);
      await expect(resetDemoData(scratch)).rejects.toBeInstanceOf(ConflictError);
    } finally {
      await holder.query("ROLLBACK");
      await holder.end();
    }
    expect(await counts(scratch)).toEqual(before);
    await expect(restoreFromSnapshot(scratchUrl)).resolves.toBeGreaterThan(0); // and it works again once the lock is free
  }, 60_000);
});
