import "dotenv/config";

import type { PrismaClient } from "@prisma/client";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createScratchDb } from "./helpers/scratch-db";
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

// The database tests run in a throwaway database made from the migrations, so they never touch the shared dev database
// the other test files assert against.
let scratch: PrismaClient;
let scratchUrl: string;
let dropScratch: () => Promise<void>;

async function counts(db: PrismaClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of demoSnapshot.tables) out[t.name] = Number((await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t.name}"`))[0].n);
  return out;
}

describe("restoring the snapshot", () => {
  beforeAll(async () => {
    const db = await createScratchDb("customer_hub_snapshot_test");
    scratch = db.client;
    scratchUrl = db.url;
    dropScratch = db.drop;
  }, 60_000);

  afterAll(async () => {
    await dropScratch?.();
  });

  it("covers every data table and gives the same row counts as the snapshot", async () => {
    const tables = (await scratch.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`).map((r) => r.tablename);
    const data = tables.filter((t) => !["DemoMeta", "DemoSandbox", "_prisma_migrations"].includes(t)).sort();
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
