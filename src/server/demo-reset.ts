import { Pool } from "pg";
import type { Prisma, PrismaClient } from "@prisma/client";

import { seed } from "@seed/seed";

import { today } from "@/lib/dates";
import { ConflictError } from "@/server/errors";
import { buildRestoreSql, demoSnapshot, type DemoSnapshot } from "@/server/demo-snapshot";
import { poolConfig } from "@/server/pool-config";

/** Arbitrary constant: the one advisory lock every restore takes, so two restores never run at once. */
export const RESTORE_LOCK_KEY = 7_315_042_001;

const BUSY = "A restore is already running. Try again in a few seconds.";

/** Every data table except DemoMeta (brief 7.2.3) and Prisma's own migrations table. Read from the catalog, so a new table is never forgotten (TeamBusinessHours was once). */
export const KEEP_TABLES = ["DemoMeta", "DemoSandbox", "_prisma_migrations"];

async function dataTables(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  return rows.map((r) => r.tablename).filter((t) => !KEEP_TABLES.includes(t));
}

/**
 * Brief 7.2.3: truncate every data table, reseed with today from src/lib/dates.ts. Runs on the admin client
 * (DATABASE_ADMIN_URL). The slow path: it runs the seed itself, so it works at any clock, which `npm run
 * demo:reset-data` (test:all) and the snapshot generator need. The app uses restoreDemoData() below, which
 * takes the snapshot path when it can.
 *
 * One transaction: TRUNCATE and seed commit together, so a failure leaves the previous data intact, and the
 * restore advisory lock keeps two restores from running at once (a second one fails fast with a 409).
 * Unlike `npm run db:reset`, this never calls `prisma migrate reset`, so it doesn't trigger Prisma's AI-agent
 * consent gate (DECISIONS.md) — safe to run unattended, e.g. from `test:all`.
 */
export async function resetDemoData(db: PrismaClient): Promise<number> {
  return db.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRawUnsafe<{ locked: boolean }[]>(`SELECT pg_try_advisory_xact_lock(${RESTORE_LOCK_KEY}) AS locked`);
      if (!locked) throw new ConflictError(BUSY);
      const tables = await dataTables(tx);
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
      await seed(tx as unknown as PrismaClient); // seed() itself bumps DemoMeta.seedVersion (prisma/seed/seed.ts, Phase 16)
      // The data is fresh: nothing written since, and visitors who arrived before this moment get a new clock (src/server/demo-idle.ts).
      await tx.$executeRawUnsafe(`UPDATE "DemoMeta" SET "lastWriteAt" = NULL, "lastRestoreAt" = clock_timestamp() WHERE "id" = 1`);
      return (await tx.demoMeta.findUniqueOrThrow({ where: { id: 1 } })).seedVersion;
    },
    // The seed is thousands of statements; on a database a network hop away it can take minutes. 280 s sits inside maxDuration (300 s).
    { timeout: 280_000, maxWait: 15_000 },
  );
}

/** Whether the generated snapshot is what the seed would produce right now (same day, cache-only GLEIF, default cache file). */
export function snapshotApplies(): boolean {
  const cachePath = process.env.GLEIF_CACHE_PATH;
  return (
    process.env.GLEIF_SEED_SOURCE === "cache" &&
    (!cachePath || cachePath === "data/gleif-cache.json") &&
    today() === demoSnapshot.seedToday
  );
}

/** The snapshot path: one transaction, three round trips (lock, replace, bump), whatever the number of rows. */
export async function restoreFromSnapshot(adminUrl: string | undefined, snapshot: DemoSnapshot = demoSnapshot): Promise<number> {
  const pool = new Pool(poolConfig(adminUrl));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const lock = await client.query(`SELECT pg_try_advisory_xact_lock(${RESTORE_LOCK_KEY}) AS locked`);
      if (!lock.rows[0].locked) throw new ConflictError(BUSY);
      await client.query(buildRestoreSql(snapshot));
      const meta = await client.query(
        `INSERT INTO "DemoMeta" ("id", "seedVersion", "lastRestoreAt") VALUES (1, 1, clock_timestamp()) ON CONFLICT ("id") DO UPDATE SET "seedVersion" = "DemoMeta"."seedVersion" + 1, "lastWriteAt" = NULL, "lastRestoreAt" = clock_timestamp() RETURNING "seedVersion"`,
      );
      await client.query("COMMIT");
      return meta.rows[0].seedVersion as number;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

/** The app's restore: the snapshot when it applies, otherwise the seed (same guarantees either way). Returns the new seedVersion. */
export async function restoreDemoData(createDb: () => PrismaClient): Promise<{ seedVersion: number; mode: "snapshot" | "seed" }> {
  if (snapshotApplies()) return { seedVersion: await restoreFromSnapshot(process.env.DATABASE_ADMIN_URL), mode: "snapshot" };
  const db = createDb();
  try {
    return { seedVersion: await resetDemoData(db), mode: "seed" };
  } finally {
    await db.$disconnect();
  }
}
